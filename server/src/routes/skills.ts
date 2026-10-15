import { Router } from "express";
import { nanoid } from "nanoid";
import { SkillCreateInputSchema, type SkillDefinition } from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { validateSkillDefinition } from "../services/skills/validator.js";

export const skillsRouter: Router = Router();

function rowToDefinition(row: Record<string, unknown>): SkillDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    version: String(row.version),
    authorId: (row.authorId as string | null) ?? null,
    category: String(row.category),
    description: String(row.description),
    systemPrompt: String(row.systemPrompt),
    inputSchema: JSON.parse(String(row.inputSchema ?? "{}")),
    outputSchema: JSON.parse(String(row.outputSchema ?? "{}")),
    requiredCapabilities: JSON.parse(String(row.requiredCapabilities ?? "[]")),
    permissions: JSON.parse(String(row.permissions ?? "[]")),
    allowedTools: JSON.parse(String(row.allowedTools ?? "[]")),
    executable: false,
    enabled: Number(row.enabled) === 1,
    builtIn: Number(row.builtIn) === 1,
  };
}

skillsRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT id, name, version, author_id as authorId, category, description, system_prompt as systemPrompt,
              input_schema_json as inputSchema, output_schema_json as outputSchema,
              required_capabilities_json as requiredCapabilities, permissions_json as permissions,
              allowed_tools_json as allowedTools, executable, enabled, built_in as builtIn
       FROM skills
       WHERE built_in = 1 OR author_id = ?
       ORDER BY category, name`,
    )
    .all(user.id) as Array<Record<string, unknown>>;
  res.json({ skills: rows.map(rowToDefinition) });
});

skillsRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = SkillCreateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid skill.", details: parsed.error.flatten() } });
    return;
  }
  const def: SkillDefinition = {
    ...parsed.data,
    id: parsed.data.id ?? `skill.${nanoid(10)}`,
    authorId: user.id,
    builtIn: false,
    enabled: parsed.data.enabled ?? true,
    executable: false,
  };
  const validation = validateSkillDefinition(def);
  if (!validation.ok) {
    res.status(400).json({ error: { code: "unsafe_skill", message: validation.reason } });
    return;
  }
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO skills
       (id, name, version, author_id, category, description, system_prompt,
        input_schema_json, output_schema_json, required_capabilities_json,
        permissions_json, allowed_tools_json, executable, enabled, built_in,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
    ).run(
      def.id,
      def.name,
      def.version,
      def.authorId,
      def.category,
      def.description,
      def.systemPrompt,
      JSON.stringify(def.inputSchema),
      JSON.stringify(def.outputSchema),
      JSON.stringify(def.requiredCapabilities),
      JSON.stringify(def.permissions),
      JSON.stringify(def.allowedTools),
      def.enabled ? 1 : 0,
      now,
      now,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: { code: "conflict", message } });
    return;
  }
  res.status(201).json({ skill: def });
});

skillsRouter.delete("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const result = db
    .prepare(`DELETE FROM skills WHERE id = ? AND author_id = ? AND built_in = 0`)
    .run(req.params.id, user.id);
  if (result.changes === 0) {
    res.status(404).json({ error: { code: "not_found", message: "Skill not found or not owned by you." } });
    return;
  }
  res.json({ ok: true });
});
