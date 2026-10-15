import { Router } from "express";
import { nanoid } from "nanoid";
import { ProjectInputSchema, type Project } from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const projectsRouter: Router = Router();

projectsRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT id, owner_id as ownerId, name, description, created_at as createdAt, updated_at as updatedAt
       FROM projects WHERE owner_id = ? ORDER BY updated_at DESC`,
    )
    .all(user.id) as Project[];
  res.json({ projects: rows });
});

projectsRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = ProjectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid project.", details: parsed.error.flatten() } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, parsed.data.name, parsed.data.description ?? null, now, now);
  const project: Project = {
    id,
    ownerId: user.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  res.status(201).json({ project });
});

projectsRouter.get("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT id, owner_id as ownerId, name, description, created_at as createdAt, updated_at as updatedAt
       FROM projects WHERE id = ?`,
    )
    .get(req.params.id) as Project | undefined;
  if (!row || row.ownerId !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
    return;
  }
  res.json({ project: row });
});

projectsRouter.patch("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const existing = db
    .prepare(`SELECT id, owner_id FROM projects WHERE id = ?`)
    .get(req.params.id) as { id: string; owner_id: string } | undefined;
  if (!existing || existing.owner_id !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
    return;
  }
  const parsed = ProjectInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid project.", details: parsed.error.flatten() } });
    return;
  }
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE projects
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         updated_at = ?
     WHERE id = ?`,
  ).run(parsed.data.name ?? null, parsed.data.description ?? null, now, existing.id);
  const row = db
    .prepare(
      `SELECT id, owner_id as ownerId, name, description, created_at as createdAt, updated_at as updatedAt
       FROM projects WHERE id = ?`,
    )
    .get(existing.id) as Project;
  res.json({ project: row });
});

projectsRouter.delete("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const result = db
    .prepare(`DELETE FROM projects WHERE id = ? AND owner_id = ?`)
    .run(req.params.id, user.id);
  if (result.changes === 0) {
    res.status(404).json({ error: { code: "not_found", message: "Project not found." } });
    return;
  }
  res.json({ ok: true });
});
