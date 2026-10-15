/**
 * Tiny redacting logger.
 *
 * Scrubs API keys, passwords, tokens, cookies, and JWTs from stringified
 * payloads before printing. The point is defense-in-depth — the
 * application still enforces the actual secret boundary.
 */
const REDACT_KEYS = [
  "api_key",
  "apiKey",
  "apikey",
  "password",
  "passwd",
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "jwt",
  "bearer",
  "cookie",
  "set-cookie",
  "secret",
];

const REDACT_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_\-]{8,}/g,
  /\bxai-[A-Za-z0-9_\-]{8,}/g,
  /\bghp_[A-Za-z0-9]{8,}/g,
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
];

function redactString(input: string): string {
  let out = input;
  for (const re of REDACT_PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => redactValue(v, seen));
  if (typeof value === "object") {
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (REDACT_KEYS.includes(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v, seen);
      }
    }
    return out;
  }
  return String(value);
}

type Level = "info" | "warn" | "error" | "debug";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const payload = {
    t: new Date().toISOString(),
    level,
    msg: redactString(msg),
    ...(fields ? (redactValue(fields) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  child: (prefix: string) => ({
    info: (msg: string, fields?: Record<string, unknown>) => emit("info", `[${prefix}] ${msg}`, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", `[${prefix}] ${msg}`, fields),
    error: (msg: string, fields?: Record<string, unknown>) => emit("error", `[${prefix}] ${msg}`, fields),
    debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", `[${prefix}] ${msg}`, fields),
  }),
};
