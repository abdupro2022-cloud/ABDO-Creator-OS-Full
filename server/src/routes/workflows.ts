import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { resolveProviderForUser } from "./providers.js";
import { runWorkflow, FULL_CHAIN, SIMPLE_CHAIN } from "../services/agents/orchestrator.js";
import { logger } from "../logger.js";
import type { AgentRole } from "@abdo/shared";

export const workflowsRouter: Router = Router();

const CreateWorkflowSchema = z.object({
  prompt: z.string().min(1).max(20_000),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  roleGuidance: z.string().max(2000).optional(),
  taskClass: z.enum(["simple", "standard", "full"]).default("standard"),
  providerConfigId: z.string().optional(),
  model: z.string().optional(),
});

workflowsRouter.post("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const parsed = CreateWorkflowSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid workflow input.", details: parsed.error.flatten() } });
    return;
  }
  const provider = resolveProviderForUser(user.id, parsed.data.providerConfigId, parsed.data.model);
  if (!provider) {
    res.status(409).json({
      error: { code: "no_provider_configured", message: "No provider is configured for this user. Add a provider API key in Provider & Model Integrations first." },
    });
    return;
  }
  const chain: AgentRole[] =
    parsed.data.taskClass === "simple"
      ? SIMPLE_CHAIN
      : parsed.data.taskClass === "full"
      ? FULL_CHAIN
      : (["advocate", "critic", "synthesizer", "reviewer"] as AgentRole[]);
  const runId = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO workflow_runs (id, owner_id, project_id, conversation_id, task_class, user_prompt, role_guidance, provider_config_id, model, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    runId,
    user.id,
    parsed.data.projectId ?? null,
    parsed.data.conversationId ?? null,
    parsed.data.taskClass,
    parsed.data.prompt,
    parsed.data.roleGuidance ?? null,
    provider.configId,
    provider.model,
    now,
    now,
  );
  logger.info("workflow run created", { runId, userId: user.id, taskClass: parsed.data.taskClass, chain });
  // Fire-and-track; the orchestrator updates DB. Return immediately with the run id.
  void runWorkflow({
    runId,
    userId: user.id,
    userPrompt: parsed.data.prompt,
    roleGuidance: parsed.data.roleGuidance,
    provider,
    chain,
  }).catch((err) => {
    logger.error("workflow run threw", { runId, message: err instanceof Error ? err.message : String(err) });
    db.prepare(`UPDATE workflow_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`).run(
      err instanceof Error ? err.message : String(err),
      new Date().toISOString(),
      runId,
    );
  });
  res.status(202).json({ runId, status: "pending", chain });
});

workflowsRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const rows = projectId
    ? db
        .prepare(
          `SELECT id, project_id as projectId, conversation_id as conversationId, task_class as taskClass,
                  user_prompt as userPrompt, role_guidance as roleGuidance, provider_config_id as providerConfigId,
                  model, status, current_step as currentStep, error, created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
           FROM workflow_runs WHERE owner_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 100`,
        )
        .all(user.id, projectId)
    : db
        .prepare(
          `SELECT id, project_id as projectId, conversation_id as conversationId, task_class as taskClass,
                  user_prompt as userPrompt, role_guidance as roleGuidance, provider_config_id as providerConfigId,
                  model, status, current_step as currentStep, error, created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
           FROM workflow_runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100`,
        )
        .all(user.id);
  res.json({ runs: rows });
});

workflowsRouter.get("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT id, owner_id as ownerId, project_id as projectId, conversation_id as conversationId, task_class as taskClass,
              user_prompt as userPrompt, role_guidance as roleGuidance, provider_config_id as providerConfigId,
              model, status, current_step as currentStep, final_output_json as finalOutputJson, error,
              created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
       FROM workflow_runs WHERE id = ?`,
    )
    .get(req.params.id) as
    | { ownerId: string; [k: string]: unknown }
    | undefined;
  if (!row || row.ownerId !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Run not found." } });
    return;
  }
  const steps = db
    .prepare(
      `SELECT id, step_index as stepIndex, role, input_json as inputJson, output_json as outputJson,
              status, error, attempts, started_at as startedAt, completed_at as completedAt
       FROM workflow_steps WHERE run_id = ? ORDER BY step_index ASC`,
    )
    .all(req.params.id);
  res.json({ run: row, steps });
});

workflowsRouter.post("/:id/cancel", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db.prepare(`SELECT owner_id, status FROM workflow_runs WHERE id = ?`).get(req.params.id) as { owner_id: string; status: string } | undefined;
  if (!row || row.owner_id !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Run not found." } });
    return;
  }
  if (row.status === "completed" || row.status === "failed" || row.status === "cancelled") {
    res.status(409).json({ error: { code: "not_running", message: `Run is already ${row.status}.` } });
    return;
  }
  db.prepare(`UPDATE workflow_runs SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});
