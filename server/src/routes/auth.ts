import { Router } from "express";
import { nanoid } from "nanoid";
import { SignInInputSchema, SignUpInputSchema } from "@abdo/shared";
import { db } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signSession } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { logger } from "../logger.js";

export const authRouter: Router = Router();

authRouter.post("/signup", async (req, res) => {
  const parsed = SignUpInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid signup input.", details: parsed.error.flatten() } });
    return;
  }
  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: { code: "email_taken", message: "Email is already registered." } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'user', ?, ?)`,
  ).run(id, normalizedEmail, displayName ?? null, passwordHash, now, now);

  const token = signSession({ sub: id, role: "user" });
  logger.info("user signed up", { userId: id });
  res.status(201).json({
    token,
    user: { id, email: normalizedEmail, displayName: displayName ?? null, role: "user", createdAt: now },
  });
});

authRouter.post("/signin", async (req, res) => {
  const parsed = SignInInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid signin input.", details: parsed.error.flatten() } });
    return;
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const row = db
    .prepare(
      `SELECT id, email, display_name as displayName, password_hash, role, created_at as createdAt
       FROM users WHERE email = ?`,
    )
    .get(normalizedEmail) as
    | { id: string; email: string; displayName: string | null; password_hash: string; role: "user" | "admin"; createdAt: string }
    | undefined;
  if (!row) {
    res.status(401).json({ error: { code: "invalid_credentials", message: "Invalid email or password." } });
    return;
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: { code: "invalid_credentials", message: "Invalid email or password." } });
    return;
  }
  const token = signSession({ sub: row.id, role: row.role });
  logger.info("user signed in", { userId: row.id });
  res.json({
    token,
    user: { id: row.id, email: row.email, displayName: row.displayName, role: row.role, createdAt: row.createdAt },
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/signout", requireAuth, (req, res) => {
  // Stateless JWT — client discards token. Hook for a future blocklist.
  res.json({ ok: true });
});
