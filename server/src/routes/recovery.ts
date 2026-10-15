import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { hashPassword } from "../auth/password.js";
import { logger } from "../logger.js";

export const recoveryRouter: Router = Router();

/**
 * Password recovery.
 *
 * Out-of-scope: actually sending email (no SMTP in this sandbox).
 * In-scope: the secure token flow. A real deployment would plug SMTP / SES / Resend /
 * Postmark into `notifyReset()`. The token is single-use, time-limited, hashed at rest.
 *
 * To exercise: POST /api/auth/recovery/request with an email; the response includes
 * the token in dev only when `NODE_ENV !== "production"`. The user pastes the token
 * and a new password to /api/auth/recovery/reset.
 */

const RequestSchema = z.object({ email: z.string().email() });
const ResetSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(200),
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

recoveryRouter.post("/recovery/request", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid email." } });
    return;
  }
  const user = db.prepare(`SELECT id, email FROM users WHERE email = ?`).get(parsed.data.email.toLowerCase()) as { id: string; email: string } | undefined;
  // Always 200 to avoid email enumeration
  if (!user) {
    res.json({ ok: true });
    return;
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const id = (await import("nanoid")).nanoid();
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000); // 1h
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, user.id, tokenHash, expires.toISOString(), now.toISOString());
  logger.info("password reset requested", { userId: user.id });
  // In dev, return the token so the user can complete the flow without an SMTP server.
  // In production this MUST be removed and a real email must be sent instead.
  const payload: { ok: true; devToken?: string } = { ok: true };
  if (process.env.NODE_ENV !== "production") {
    payload.devToken = token;
  }
  res.json(payload);
});

recoveryRouter.post("/recovery/reset", async (req, res) => {
  const parsed = ResetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid reset payload." } });
    return;
  }
  const tokenHash = hashToken(parsed.data.token);
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?`,
    )
    .get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
  if (!row) {
    res.status(400).json({ error: { code: "invalid_token", message: "Invalid or expired token." } });
    return;
  }
  if (row.used_at) {
    res.status(400).json({ error: { code: "token_used", message: "Token already used." } });
    return;
  }
  if (new Date(row.expires_at) < new Date()) {
    res.status(400).json({ error: { code: "token_expired", message: "Token has expired." } });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(passwordHash, now, row.user_id);
    db.prepare(`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`).run(now, row.id);
  });
  tx();
  logger.info("password reset completed", { userId: row.user_id });
  res.json({ ok: true });
});
