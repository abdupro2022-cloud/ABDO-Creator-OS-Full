import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCMTypes,
} from "node:crypto";
import { config } from "../config.js";

/**
 * AES-256-GCM envelope encryption for user provider API keys.
 *
 * Layout:  [12-byte IV] [16-byte auth tag] [ciphertext]
 * Encoded as a single Buffer; encoded as base64 for storage.
 *
 * AAD (additional authenticated data) is the literal string
 * "abdo/provider-key" so this envelope cannot be repurposed for other data.
 */

const ALGO: CipherGCMTypes = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const AAD = Buffer.from("abdo/provider-key");

function getKey(): Buffer {
  const k = config.appKek;
  if (!k || k.length < 64) {
    // 32 bytes hex = 64 chars
    throw new Error(
      "APP_KEK must be a 32-byte hex string (64 chars). Refusing to encrypt with a weak key.",
    );
  }
  return Buffer.from(k.slice(0, 64), "hex");
}

export function encryptSecret(plaintext: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const key = getKey();
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(AAD);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LEN) throw new Error("unexpected GCM tag length");
  return Buffer.concat([iv, tag, enc]);
}

export function decryptSecret(blob: Buffer): string {
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("ciphertext too short");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = blob.subarray(IV_LEN + TAG_LEN);
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
