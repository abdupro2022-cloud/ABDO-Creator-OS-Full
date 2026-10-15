import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const conversationsRouter: Router = Router();

const CreateSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200).default("New conversation"),
});

function userOwnsProject(userId: string, projectId: string): boolean {
  const row = db.prepare(`SELECT 1 as ok FROM projects WHERE id = ? AND owner_id = ?`).get(projectId, userId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

conversationsRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid conversation.", details: parsed.error.flatten() } });
    return;
  }
  if (!userOwnsProject(user.id, parsed.data.projectId)) {
    res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO conversations (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run(id, parsed.data.projectId, parsed.data.title, now, now);
  res.status(201).json({ conversation: { id, projectId: parsed.data.projectId, title: parsed.data.title, createdAt: now, updatedAt: now } });
});

conversationsRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  if (projectId && !userOwnsProject(user.id, projectId)) {
    res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
    return;
  }
  const rows = projectId
    ? db
        .prepare(
          `SELECT c.id, c.project_id as projectId, c.title, c.created_at as createdAt, c.updated_at as updatedAt
           FROM conversations c
           JOIN projects p ON p.id = c.project_id
           WHERE p.owner_id = ? AND c.project_id = ?
           ORDER BY c.updated_at DESC`,
        )
        .all(user.id, projectId)
    : db
        .prepare(
          `SELECT c.id, c.project_id as projectId, c.title, c.created_at as createdAt, c.updated_at as updatedAt
           FROM conversations c
           JOIN projects p ON p.id = c.project_id
           WHERE p.owner_id = ?
           ORDER BY c.updated_at DESC`,
        )
        .all(user.id);
  res.json({ conversations: rows });
});

conversationsRouter.get("/:id/messages", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT c.id, p.owner_id as ownerId
       FROM conversations c JOIN projects p ON p.id = c.project_id
       WHERE c.id = ?`,
    )
    .get(req.params.id) as { id: string; ownerId: string } | undefined;
  if (!row || row.ownerId !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Conversation not found." } });
    return;
  }
  const messages = db
    .prepare(
      `SELECT id, conversation_id as conversationId, role, content, created_at as createdAt
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    )
    .all(req.params.id);
  res.json({ messages });
});

const AppendSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1).max(50_000),
});

conversationsRouter.post("/:id/messages", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT c.id, p.owner_id as ownerId
       FROM conversations c JOIN projects p ON p.id = c.project_id
       WHERE c.id = ?`,
    )
    .get(req.params.id) as { id: string; ownerId: string } | undefined;
  if (!row || row.ownerId !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Conversation not found." } });
    return;
  }
  const parsed = AppendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid message.", details: parsed.error.flatten() } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`).run(id, req.params.id, parsed.data.role, parsed.data.content, now);
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, req.params.id);
  res.status(201).json({ message: { id, conversationId: req.params.id, role: parsed.data.role, content: parsed.data.content, createdAt: now } });
});
