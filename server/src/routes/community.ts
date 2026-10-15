import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requireAdmin } from "../auth/middleware.js";

export const communityRouter: Router = Router();

const PublishSchema = z.object({
  skillId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
});

const ModerateSchema = z.object({
  state: z.enum(["pending_review", "published", "rejected", "removed"]),
  notes: z.string().max(2000).optional(),
});

function userOwnsSkill(userId: string, skillId: string): boolean {
  const row = db.prepare(`SELECT 1 as ok FROM skills WHERE id = ? AND author_id = ?`).get(skillId, userId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

communityRouter.post("/publishes", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = PublishSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid publish request.", details: parsed.error.flatten() } });
    return;
  }
  if (!userOwnsSkill(user.id, parsed.data.skillId)) {
    res.status(404).json({ error: { code: "not_found", message: "Skill not found or not owned by you." } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO community_skill_publishes (id, skill_id, publisher_id, title, description, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending_review', ?, ?)`,
  ).run(id, parsed.data.skillId, user.id, parsed.data.title, parsed.data.description, now, now);
  res.status(201).json({ publish: { id, state: "pending_review", title: parsed.data.title, description: parsed.data.description, createdAt: now } });
});

communityRouter.get("/publishes", requireAuth, (req, res) => {
  const user = req.user!;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const rows = state
    ? db
        .prepare(
          `SELECT id, skill_id as skillId, publisher_id as publisherId, title, description, state, moderator_id as moderatorId,
                  moderation_notes as moderationNotes, created_at as createdAt, updated_at as updatedAt, published_at as publishedAt
           FROM community_skill_publishes WHERE state = ? ORDER BY updated_at DESC LIMIT 100`,
        )
        .all(state)
    : db
        .prepare(
          `SELECT id, skill_id as skillId, publisher_id as publisherId, title, description, state, moderator_id as moderatorId,
                  moderation_notes as moderationNotes, created_at as createdAt, updated_at as updatedAt, published_at as publishedAt
           FROM community_skill_publishes ORDER BY updated_at DESC LIMIT 100`,
        )
        .all();
  res.json({ publishes: rows });
});

communityRouter.get("/mine", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT id, skill_id as skillId, publisher_id as publisherId, title, description, state, moderator_id as moderatorId,
              moderation_notes as moderationNotes, created_at as createdAt, updated_at as updatedAt, published_at as publishedAt
       FROM community_skill_publishes WHERE publisher_id = ? ORDER BY updated_at DESC`,
    )
    .all(user.id);
  res.json({ publishes: rows });
});

communityRouter.post("/publishes/:id/moderate", requireAuth, requireAdmin, (req, res) => {
  const user = req.user!;
  const parsed = ModerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid moderation.", details: parsed.error.flatten() } });
    return;
  }
  const row = db.prepare(`SELECT state FROM community_skill_publishes WHERE id = ?`).get(req.params.id) as { state: string } | undefined;
  if (!row) {
    res.status(404).json({ error: { code: "not_found", message: "Publish not found." } });
    return;
  }
  const now = new Date().toISOString();
  const publishedAt = parsed.data.state === "published" ? now : null;
  db.prepare(
    `UPDATE community_skill_publishes
     SET state = ?, moderator_id = ?, moderation_notes = ?, published_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(parsed.data.state, user.id, parsed.data.notes ?? null, publishedAt, now, req.params.id);
  res.json({ ok: true, state: parsed.data.state });
});
