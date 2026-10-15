import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const scriptsRouter: Router = Router();

const ScriptInputSchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().optional(),
  hook: z.string().max(20_000).default(""),
  body: z.string().max(100_000).default(""),
  outro: z.string().max(20_000).default(""),
});

const ScriptUpdateSchema = ScriptInputSchema.partial();

function userOwnsScript(userId: string, scriptId: string): boolean {
  const row = db.prepare(`SELECT 1 as ok FROM scripts WHERE id = ? AND owner_id = ?`).get(scriptId, userId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

scriptsRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = ScriptInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid script.", details: parsed.error.flatten() } });
    return;
  }
  if (parsed.data.projectId) {
    const own = db.prepare(`SELECT 1 as ok FROM projects WHERE id = ? AND owner_id = ?`).get(parsed.data.projectId, user.id) as { ok: number } | undefined;
    if (!own?.ok) {
      res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
      return;
    }
  }
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO scripts (id, owner_id, project_id, title, hook, body, outro, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, parsed.data.projectId ?? null, parsed.data.title, parsed.data.hook, parsed.data.body, parsed.data.outro, now, now);
  res.status(201).json({
    script: { id, ownerId: user.id, projectId: parsed.data.projectId ?? null, title: parsed.data.title, hook: parsed.data.hook, body: parsed.data.body, outro: parsed.data.outro, createdAt: now, updatedAt: now },
  });
});

scriptsRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const rows = projectId
    ? db
        .prepare(
          `SELECT id, owner_id as ownerId, project_id as projectId, title, hook, body, outro, created_at as createdAt, updated_at as updatedAt
           FROM scripts WHERE owner_id = ? AND project_id = ? ORDER BY updated_at DESC`,
        )
        .all(user.id, projectId)
    : db
        .prepare(
          `SELECT id, owner_id as ownerId, project_id as projectId, title, hook, body, outro, created_at as createdAt, updated_at as updatedAt
           FROM scripts WHERE owner_id = ? ORDER BY updated_at DESC`,
        )
        .all(user.id);
  res.json({ scripts: rows });
});

scriptsRouter.get("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  if (!userOwnsScript(user.id, req.params.id)) {
    res.status(404).json({ error: { code: "not_found", message: "Script not found." } });
    return;
  }
  const row = db
    .prepare(
      `SELECT id, owner_id as ownerId, project_id as projectId, title, hook, body, outro, created_at as createdAt, updated_at as updatedAt
       FROM scripts WHERE id = ?`,
    )
    .get(req.params.id);
  res.json({ script: row });
});

scriptsRouter.patch("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  if (!userOwnsScript(user.id, req.params.id)) {
    res.status(404).json({ error: { code: "not_found", message: "Script not found." } });
    return;
  }
  const parsed = ScriptUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid script.", details: parsed.error.flatten() } });
    return;
  }
  const now = new Date().toISOString();
  const existing = db.prepare(`SELECT hook, body, outro FROM scripts WHERE id = ?`).get(req.params.id) as { hook: string; body: string; outro: string };
  const next = {
    hook: parsed.data.hook ?? existing.hook,
    body: parsed.data.body ?? existing.body,
    outro: parsed.data.outro ?? existing.outro,
  };
  // Snapshot a revision if content changed
  if (next.hook !== existing.hook || next.body !== existing.body || next.outro !== existing.outro) {
    db.prepare(
      `INSERT INTO script_revisions (id, script_id, hook, body, outro, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(nanoid(), req.params.id, existing.hook, existing.body, existing.outro, now);
  }
  db.prepare(
    `UPDATE scripts SET title = COALESCE(?, title), hook = ?, body = ?, outro = ?, updated_at = ? WHERE id = ?`,
  ).run(parsed.data.title ?? null, next.hook, next.body, next.outro, now, req.params.id);
  const row = db
    .prepare(
      `SELECT id, owner_id as ownerId, project_id as projectId, title, hook, body, outro, created_at as createdAt, updated_at as updatedAt
       FROM scripts WHERE id = ?`,
    )
    .get(req.params.id);
  res.json({ script: row });
});

scriptsRouter.get("/:id/revisions", requireAuth, (req, res) => {
  const user = req.user!;
  if (!userOwnsScript(user.id, req.params.id)) {
    res.status(404).json({ error: { code: "not_found", message: "Script not found." } });
    return;
  }
  const rows = db
    .prepare(
      `SELECT id, script_id as scriptId, hook, body, outro, created_at as createdAt
       FROM script_revisions WHERE script_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(req.params.id);
  res.json({ revisions: rows });
});

scriptsRouter.delete("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const result = db.prepare(`DELETE FROM scripts WHERE id = ? AND owner_id = ?`).run(req.params.id, user.id);
  if (result.changes === 0) {
    res.status(404).json({ error: { code: "not_found", message: "Script not found." } });
    return;
  }
  res.json({ ok: true });
});
