import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { AgentTurnOutputSchema, ChatRequestSchema, type AgentTurnOutput, type AgentRole } from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { openaiCompatibleAdapter, ProviderError } from "../services/providers/openaiCompatible.js";
import { resolveProviderForUser } from "./providers.js";
import { logger } from "../logger.js";

export const agentsRouter: Router = Router();

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

/**
 * One bounded repair attempt: if the model's output doesn't parse,
 * re-call once with an explicit instruction to fix the JSON, then stop.
 * We don't loop forever (credit discipline).
 */
async function callAndRepair(
  params: Parameters<typeof openaiCompatibleAdapter.call>[0],
  role: AgentRole,
): Promise<{ text: string; output: AgentTurnOutput; usage: Awaited<ReturnType<typeof openaiCompatibleAdapter.call>>["usage"]; warnings: string[] }> {
  const first = await openaiCompatibleAdapter.call({ ...params, structured: true });
  const parsedFirst = AgentTurnOutputSchema.safeParse(extractJson(first.text));
  if (parsedFirst.success) {
    return { text: first.text, output: parsedFirst.data, usage: first.usage, warnings: first.warnings };
  }
  // Bounded repair
  const repair = await openaiCompatibleAdapter.call({
    ...params,
    structured: true,
    systemPrompt: params.systemPrompt + "\n\nYour previous response did not match the required JSON schema. Return ONLY a single JSON object that exactly matches the schema, with no markdown fences and no extra text.",
    userPrompt: params.userPrompt,
  });
  const parsedRepair = AgentTurnOutputSchema.safeParse(extractJson(repair.text));
  if (parsedRepair.success) {
    return { text: repair.text, output: parsedRepair.data, usage: repair.usage, warnings: [...first.warnings, "repair:1"] };
  }
  // Fail safely with a structured error object
  const fallback: AgentTurnOutput = {
    status: "error",
    summary: "The model returned output that did not match the required schema, even after one repair attempt.",
    key_points: ["Output validation failed."],
    recommendations: ["Re-run the request, simplify the prompt, or try a different model."],
    assumptions: [],
    risks: ["Unverified content was not returned to the user."],
    confidence: 0,
    next_actions: ["Retry with a different model or simpler prompt."],
  };
  return { text: repair.text, output: fallback, usage: repair.usage, warnings: [...first.warnings, "repair:1:failed"] };
}

function extractJson(text: string): unknown {
  // First, try a direct parse.
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }
  // Then, try to extract the largest {...} block.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return text; // give up; will fail schema
    }
  }
  return text;
}

agentsRouter.post("/chat", requireAuth, async (req, res) => {
  const user = req.user!;
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid chat request.", details: parsed.error.flatten() } });
    return;
  }
  const provider = resolveProviderForUser(user.id, parsed.data.providerConfigId, parsed.data.model);
  if (!provider) {
    res.status(409).json({
      error: {
        code: "no_provider_configured",
        message:
          "No provider is configured for this user. Add a provider API key in Provider & Model Integrations before chatting.",
      },
    });
    return;
  }

  const role: AgentRole = "advocate"; // vertical slice: single-role fast path
  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{role}}", role) + "\n\n" + ROLE_GUIDANCE[role];
  const userPrompt =
    (parsed.data.roleGuidance ? `Additional guidance: ${parsed.data.roleGuidance}\n\n` : "") +
    `User request:\n${parsed.data.prompt}`;

  try {
    const result = await callAndRepair(
      {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: parsed.data.model ?? provider.model,
        systemPrompt,
        userPrompt,
        temperature: parsed.data.temperature,
        structured: true,
      },
      role,
    );

    db.prepare(
      `INSERT INTO usage_records (id, user_id, provider_config_id, model, prompt_tokens, completion_tokens, total_tokens, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      nanoid(),
      user.id,
      provider.configId,
      parsed.data.model ?? provider.model,
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens,
      result.usage.source,
      new Date().toISOString(),
    );

    res.json({
      providerId: provider.configId,
      model: parsed.data.model ?? provider.model,
      role,
      output: result.output,
      usage: result.usage,
      rawText: result.text,
      warnings: result.warnings,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      logger.warn("provider error", { userId: user.id, code: err.code, status: err.status });
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error("chat error", { userId: user.id, message });
    res.status(500).json({ error: { code: "internal", message } });
  }
});

/** Stub endpoint for the multi-agent workflow trace. Phase 2 turns this on. */
agentsRouter.post("/workflow", requireAuth, (req, res) => {
  res.status(501).json({
    error: {
      code: "not_implemented",
      message:
        "The full 5-role workflow is scheduled for Phase 2. The contracts, orchestrator, and per-role guidance are implemented; the synchronous runner and trace UI are next.",
    },
  });
});
