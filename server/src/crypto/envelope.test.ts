import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./envelope.js";
import { randomBytes } from "node:crypto";

// Ensure a stable key for tests (config.ts would auto-create one, but we set it directly).
process.env.APP_KEK = randomBytes(32).toString("hex");

describe("crypto/envelope (AES-256-GCM)", () => {
  it("round-trips arbitrary UTF-8", () => {
    const plaintext = "sk-OPENAI-FAKE-💡-with-some-unicode-أحمد";
    const blob = encryptSecret(plaintext);
    const recovered = decryptSecret(blob);
    expect(recovered).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encryptSecret("hello");
    const b = encryptSecret("hello");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects tampered ciphertext", () => {
    const blob = encryptSecret("secret");
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects too-short ciphertext", () => {
    expect(() => decryptSecret(Buffer.from([1, 2, 3]))).toThrow(/too short/);
  });
});
