import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// server/src/config.ts -> server/
const SERVER_ROOT = resolve(__dirname, "..");
export const PROJECT_ROOT = resolve(SERVER_ROOT, "..");

const DATA_DIR = resolve(SERVER_ROOT, ".data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readOrCreateSecretFile(name: string, envName: string, bytes: number): string {
  const env = process.env[envName];
  if (env && env.length > 0) return env;
  const file = join(DATA_DIR, name);
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const secret = randomBytes(bytes).toString("hex");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  env: process.env.NODE_ENV ?? "development",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseFile: resolve(SERVER_ROOT, process.env.DATABASE_FILE ?? ".data/abdo.sqlite"),
  dataDir: DATA_DIR,
  appKek: readOrCreateSecretFile("master.key", "APP_KEK", 32),
  jwtSecret: readOrCreateSecretFile("jwt.key", "JWT_SECRET", 32),
  workflowTimeoutMs: Number(process.env.WORKFLOW_TIMEOUT_MS ?? 60_000),
};

export function isProd(): boolean {
  return config.env === "production";
}
