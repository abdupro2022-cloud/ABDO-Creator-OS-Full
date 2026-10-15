import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const preferencesRouter: Router = Router();

const MemoryItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.string().optional(),
  createdAt: z.string(),
});

const PreferencesBodySchema = z
  .object({
    preferences: z.record(z.unknown()).default({}),
    memories: z.array(MemoryItemSchema).default([]),
  })
  .strict();

preferencesRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT preferences_json as preferencesJson, memories_json as memoriesJson, updated_at as updatedAt
       FROM user_preferences WHERE user_id = ?`,
    )
    .get(user.id) as
    | { preferencesJson: string; memoriesJson: string; updatedAt: string }
    | undefined;
  if (!row) {
    res.json({ preferences: {}, memories: [], updatedAt: null });
    return;
  }
  res.json({
    preferences: JSON.parse(row.preferencesJson),
    memories: JSON.parse(row.memoriesJson),
    updatedAt: row.updatedAt,
  });
});

preferencesRouter.put("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = PreferencesBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid preferences.", details: parsed.error.flatten() } });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_preferences (user_id, preferences_json, memories_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       preferences_json = excluded.preferences_json,
       memories_json = excluded.memories_json,
       updated_at = excluded.updated_at`,
  ).run(user.id, JSON.stringify(parsed.data.preferences), JSON.stringify(parsed.data.memories), now);
  res.json({ ok: true, updatedAt: now });
});
