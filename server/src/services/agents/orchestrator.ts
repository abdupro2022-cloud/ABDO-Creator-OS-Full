import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../../db.js";
import { logger } from "../../logger.js";
import {
  AgentTurnOutputSchema,
  type AgentRole,
  type AgentTurnOutput,
  type ChatRequest,
  type ChatResponse,
} from "@abdo/shared";
import {
  openaiCompatibleAdapter,
  ProviderError,
} from "../providers/openaiCompatible.js";
import { resolveProviderForUser, type ResolvedProvider } from "../../routes/providers.js";

const SYSTEM_PROMPT_TEMPLATE = `You are the {{role}} agent in the ABDO Creator OS multi-agent system.

Your responsibilities are narrowly scoped. Stay inside them.

When you respond, you MUST return a single JSON object with exactly these fields and no other text:
{
  "status": "ok" | "partial" | "needs_clarification" | "error",
  "summary": string,            // 1-3 sentence summary of your output
  "key_points": string[],       // 3-7 short, concrete points
  "recommendations": string[],  // 2-5 actionable recommendations
  "assumptions": string[],      // assumptions you had to make
  "risks": string[],            // risks or things that could be wrong
  "confidence": number,         // 0.0 to 1.0
  "next_actions": string[]      // what the next agent (or the user) should do next
}

Do not wrap the JSON in markdown fences. Do not include any other text before or after the JSON.`;

const ROLE_GUIDANCE: Record<AgentRole, string> = {
  advocate: `Role guidance — ADVOCATE:
Develop the user's idea. Identify opportunities, strengthen the proposal, and propose concrete improvements.
Do not yet critique; that is the Critic's job. Be constructive, specific, and grounded.`,
  critic: `Role guidance — CRITIC:
Challenge assumptions in the prior output (if any) and the user's request. Identify weaknesses, missing information, unsupported claims, and risks. Be specific. If you agree with something, say so concisely and move on.`,
  synthesizer: `Role guidance — SYNTHESIZER:
Reconcile the Advocate's proposal with the Critic's objections. Produce the strongest balanced recommendation. Resolve conflicts explicitly; do not just list both views.`,
  business_analyst: `Role guidance — BUSINESS ANALYST:
Examine audience, practical feasibility, resource requirements, and likely impact. Translate the recommendation into an actionable plan. Be realistic about effort and risk.`,
  reviewer: `Role guidance — FINAL REVIEWER:
Evaluate the combined deliverable against the user's original request, required format, factual reliability, and completeness. If the deliverable fails, give specific revision instructions and set status to "needs_clarification" with a clear next_action. Otherwise set status to "ok".`,
};

export const FULL_CHAIN: AgentRole[] = [
  "advocate",
  "critic",
  "synthesizer",
  "business_analyst",
  "reviewer",
];

export const SIMPLE_CHAIN: AgentRole[] = ["advocate"];

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return text;
    }
  }
  return text;
}

export interface StepContext {
  userPrompt: string;
  roleGuidance?: string;
  /** Outputs of previously completed steps in this run, in order. */
  priorOutputs: AgentTurnOutput[];
  priorSummaries: string[];
}

async function callAndRepair(
  params: Parameters<typeof openaiCompatibleAdapter.call>[0],
  role: AgentRole,
  log: ReturnType<typeof logger.child>,
): Promise<{ output: AgentTurnOutput; rawText: string; usage: Awaited<ReturnType<typeof openaiCompatibleAdapter.call>>["usage"]; warnings: string[] }> {
  const first = await openaiCompatibleAdapter.call({ ...params, structured: true });
  const parsed = AgentTurnOutputSchema.safeParse(extractJson(first.text));
  if (parsed.success) {
    return { output: parsed.data, rawText: first.text, usage: first.usage, warnings: first.warnings };
  }
  log.warn("first parse failed; attempting bounded repair", { role });
  const repair = await openaiCompatibleAdapter.call({
    ...params,
    structured: true,
    systemPrompt: params.systemPrompt + "\n\nYour previous response did not match the required JSON schema. Return ONLY a single JSON object that exactly matches the schema, with no markdown fences and no extra text.",
    userPrompt: params.userPrompt,
  });
  const parsedRepair = AgentTurnOutputSchema.safeParse(extractJson(repair.text));
  if (parsedRepair.success) {
    return { output: parsedRepair.data, rawText: repair.text, usage: repair.usage, warnings: [...first.warnings, "repair:1"] };
  }
  return {
    output: {
      status: "error",
      summary: "Output validation failed even after a bounded repair attempt.",
      key_points: ["Output validation failed."],
      recommendations: ["Re-run with a different model or simpler prompt."],
      assumptions: [],
      risks: ["Unverified content was not returned."],
      confidence: 0,
      next_actions: ["Retry with a different model."],
    },
    rawText: repair.text,
    usage: repair.usage,
    warnings: [...first.warnings, "repair:1:failed"],
  };
}

function buildUserPromptForRole(role: AgentRole, ctx: StepContext): string {
  let prompt = `User request:\n${ctx.userPrompt}\n\n`;
  if (ctx.roleGuidance) prompt += `Additional guidance: ${ctx.roleGuidance}\n\n`;
  if (ctx.priorOutputs.length > 0) {
    prompt += "Prior steps in this run:\n";
    ctx.priorOutputs.forEach((out, i) => {
      prompt += `\n--- Step ${i + 1} (${i === 0 ? "advocate" : i === 1 ? "critic" : i === 2 ? "synthesizer" : i === 3 ? "business_analyst" : "reviewer"}) ---\n`;
      prompt += `summary: ${out.summary}\n`;
      if (out.key_points.length > 0) prompt += `key_points: ${out.key_points.join("; ")}\n`;
      if (out.recommendations.length > 0) prompt += `recommendations: ${out.recommendations.join("; ")}\n`;
      if (out.risks.length > 0) prompt += `risks: ${out.risks.join("; ")}\n`;
    });
    prompt += "\nUse the prior steps' outputs as your input where relevant. Stay strictly inside your role guidance.\n";
  }
  return prompt;
}

function recordUsage(userId: string, providerConfigId: string, model: string, usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; source: "provider" | "estimated" | "unknown" }) {
  db.prepare(
    `INSERT INTO usage_records (id, user_id, provider_config_id, model, prompt_tokens, completion_tokens, total_tokens, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    userId,
    providerConfigId,
    model,
    usage.promptTokens,
    usage.completionTokens,
    usage.totalTokens,
    usage.source,
    new Date().toISOString(),
  );
}

export interface OrchestratorResult {
  runId: string;
  chain: AgentRole[];
  steps: Array<{
    id: string;
    role: AgentRole;
    status: string;
    output: AgentTurnOutput | null;
    error: string | null;
    attempts: number;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  finalOutput: AgentTurnOutput | null;
}

export async function runWorkflow(opts: {
  runId: string;
  userId: string;
  userPrompt: string;
  roleGuidance?: string;
  provider: ResolvedProvider;
  chain: AgentRole[];
  abortSignal?: AbortSignal;
}): Promise<OrchestratorResult> {
  const { runId, userId, userPrompt, roleGuidance, provider, chain, abortSignal } = opts;
  const log = logger.child("orchestrator");
  const now = () => new Date().toISOString();

  db.prepare(`UPDATE workflow_runs SET status = 'running', current_step = ?, updated_at = ? WHERE id = ?`).run(chain[0], now(), runId);

  const priorOutputs: AgentTurnOutput[] = [];
  const priorSummaries: string[] = [];
  const stepRecords: OrchestratorResult["steps"] = [];

  let finalOutput: AgentTurnOutput | null = null;
  let runStatus: "completed" | "failed" | "cancelled" = "completed";
  let lastError: string | null = null;

  for (let i = 0; i < chain.length; i++) {
    const role = chain[i];
    if (abortSignal?.aborted) {
      runStatus = "cancelled";
      lastError = "cancelled by user";
      break;
    }
    const stepId = nanoid();
    const startedAt = now();
    db.prepare(
      `INSERT INTO workflow_steps (id, run_id, step_index, role, input_json, status, attempts, started_at)
       VALUES (?, ?, ?, ?, ?, 'running', 0, ?)`,
    ).run(stepId, runId, i, role, JSON.stringify({ userPrompt, roleGuidance, priorSummaries }), startedAt);
    db.prepare(`UPDATE workflow_runs SET current_step = ?, updated_at = ? WHERE id = ?`).run(role, startedAt, runId);

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{role}}", role) + "\n\n" + ROLE_GUIDANCE[role];
    const userPromptForRole = buildUserPromptForRole(role, { userPrompt, roleGuidance, priorOutputs, priorSummaries });

    try {
      const result = await callAndRepair(
        {
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: provider.model,
          systemPrompt,
          userPrompt: userPromptForRole,
          structured: true,
          timeoutMs: 60_000,
        },
        role,
        log,
      );
      const completedAt = now();
      db.prepare(
        `UPDATE workflow_steps SET output_json = ?, status = 'completed', attempts = attempts + 1, completed_at = ? WHERE id = ?`,
      ).run(JSON.stringify(result.output), completedAt, stepId);
      recordUsage(userId, provider.configId, provider.model, result.usage);
      priorOutputs.push(result.output);
      priorSummaries.push(`[${role}] ${result.output.summary}`);
      stepRecords.push({
        id: stepId,
        role,
        status: "completed",
        output: result.output,
        error: null,
        attempts: 1,
        startedAt,
        completedAt,
      });
      if (role === "reviewer") {
        finalOutput = result.output;
        if (result.output.status === "error") {
          runStatus = "failed";
          lastError = result.output.summary;
        }
      }
    } catch (err) {
      const completedAt = now();
      const message = err instanceof Error ? err.message : String(err);
      log.error("step failed", { runId, role, message });
      db.prepare(`UPDATE workflow_steps SET status = 'failed', error = ?, attempts = attempts + 1, completed_at = ? WHERE id = ?`).run(message, completedAt, stepId);
      stepRecords.push({
        id: stepId,
        role,
        status: "failed",
        output: null,
        error: message,
        attempts: 1,
        startedAt,
        completedAt,
      });
      runStatus = "failed";
      lastError = message;
      // Build a synthetic reviewer output so final is never null on failure
      finalOutput = {
        status: "error",
        summary: `Workflow stopped at the ${role} step: ${message}`,
        key_points: [`Step ${role} failed.`],
        recommendations: ["Retry the run, switch provider, or simplify the prompt."],
        assumptions: [],
        risks: ["The deliverable was not finalized."],
        confidence: 0,
        next_actions: ["Retry with a different model or simpler prompt."],
      };
      break;
    }
  }

  const completedAt = now();
  db.prepare(
    `UPDATE workflow_runs SET status = ?, current_step = ?, final_output_json = ?, error = ?, updated_at = ?, completed_at = ? WHERE id = ?`,
  ).run(
    runStatus,
    runStatus === "completed" ? "reviewer" : null,
    finalOutput ? JSON.stringify(finalOutput) : null,
    lastError,
    completedAt,
    completedAt,
    runId,
  );

  return { runId, chain, steps: stepRecords, finalOutput };
}
