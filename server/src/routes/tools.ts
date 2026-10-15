import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { AgentTurnOutputSchema, type AgentTurnOutput } from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { resolveProviderForUser } from "./providers.js";
import { openaiCompatibleAdapter, ProviderError } from "../services/providers/openaiCompatible.js";
import { logger } from "../logger.js";

export const toolsRouter: Router = Router();

/**
 * Each tool has its own contract. They are not the same generic prompt.
 * The router dispatches by `tool` to a real workflow with a real provider call.
 */

interface ToolRunInput {
  systemPrompt: string;
  userPrompt: string;
  /** Optional JSON schema for additional structured output. */
  jsonHint?: string;
}

const ToolSchema = z.object({
  tool: z.enum([
    "idea_dev",
    "summary",
    "rewrite",
    "seo_outline",
    "audience_analysis",
    "repurpose",
    "youtube_outline",
  ]),
  inputs: z.record(z.unknown()).default({}),
  providerConfigId: z.string().optional(),
  model: z.string().optional(),
});

function buildTool(tool: z.infer<typeof ToolSchema>["tool"], inputs: Record<string, unknown>): ToolRunInput | { error: string } {
  switch (tool) {
    case "idea_dev": {
      const topic = String(inputs.topic ?? "").trim();
      const audience = String(inputs.audience ?? "").trim();
      if (!topic) return { error: "inputs.topic is required" };
      return {
        systemPrompt: "You are a content idea developer. Return a JSON object with fields: angles (3 distinct angles, each a string), hooks (3 short hooks), outlines (array of {angle, outline: string[]}).",
        userPrompt: `Topic: ${topic}\nAudience: ${audience || "general"}\n\nReturn ONLY the JSON.`,
      };
    }
    case "summary": {
      const text = String(inputs.text ?? "").trim();
      if (!text) return { error: "inputs.text is required" };
      const maxWords = Number(inputs.maxWords ?? 120);
      return {
        systemPrompt: "You are a summarizer. Return a JSON object with fields: executiveSummary (string, max ~80 words) and keyPoints (5-8 short strings).",
        userPrompt: `Text to summarize (within ${maxWords}-word summary):\n\n${text}`,
      };
    }
    case "rewrite": {
      const text = String(inputs.text ?? "").trim();
      const tone = String(inputs.tone ?? "neutral").trim();
      const audience = String(inputs.audience ?? "general").trim();
      if (!text) return { error: "inputs.text is required" };
      return {
        systemPrompt: "You are a rewriter. Preserve meaning, change tone. Return a JSON object with fields: rewritten (string) and changes (string[] listing 3-6 substantive changes you made).",
        userPrompt: `Tone: ${tone}\nAudience: ${audience}\n\nText:\n${text}`,
      };
    }
    case "seo_outline": {
      const topic = String(inputs.topic ?? "").trim();
      const audience = String(inputs.audience ?? "general").trim();
      if (!topic) return { error: "inputs.topic is required" };
      return {
        systemPrompt: "You are an SEO-aware content strategist. Return a JSON object with fields: titleOptions (3 title strings), primaryKeywords (3-5 short strings), secondaryKeywords (5-10 short strings), outline (array of {heading, subpoints: string[]}), metaDescription (string). Do not invent keyword difficulty or search volume numbers; if you need to estimate, label it as 'estimated'.",
        userPrompt: `Topic: ${topic}\nAudience: ${audience}`,
      };
    }
    case "audience_analysis": {
      const topic = String(inputs.topic ?? "").trim();
      const product = String(inputs.product ?? "").trim();
      if (!topic) return { error: "inputs.topic is required" };
      return {
        systemPrompt: "You are an audience analyst. Return a JSON object with fields: segments (3-4 persona objects with name, painPoints, channels, messagingAngle), objections (5-8 strings), valueProps (3-5 strings).",
        userPrompt: `Topic: ${topic}\nProduct/Offer: ${product || "n/a"}`,
      };
    }
    case "repurpose": {
      const text = String(inputs.text ?? "").trim();
      const target = String(inputs.target ?? "twitter thread").trim();
      if (!text) return { error: "inputs.text is required" };
      return {
        systemPrompt: "You are a content repurposer. Return a JSON object with fields: variants (array of {platform, content}). Each variant must be self-contained and stay faithful to the source.",
        userPrompt: `Source content:\n${text}\n\nTarget formats: ${target}`,
      };
    }
    case "youtube_outline": {
      const topic = String(inputs.topic ?? "").trim();
      const length = String(inputs.length ?? "5-7 minutes").trim();
      const audience = String(inputs.audience ?? "general").trim();
      if (!topic) return { error: "inputs.topic is required" };
      return {
        systemPrompt: "You are a YouTube script outliner. Return a JSON object with fields: titleOptions (3 strings), thumbnailConcepts (2-3 strings), hook (one strong opening line, max 30 words), sections (array of {label, beats: string[]}), cta (string).",
        userPrompt: `Topic: ${topic}\nTarget length: ${length}\nAudience: ${audience}`,
      };
    }
    default:
      return { error: `unknown tool: ${tool}` };
  }
}

toolsRouter.post("/run", requireAuth, async (req, res) => {
  const user = req.user!;
  const parsed = ToolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid tool input.", details: parsed.error.flatten() } });
    return;
  }
  const built = buildTool(parsed.data.tool, parsed.data.inputs);
  if ("error" in built) {
    res.status(400).json({ error: { code: "invalid_input", message: built.error } });
    return;
  }
  const provider = resolveProviderForUser(user.id, parsed.data.providerConfigId, parsed.data.model);
  if (!provider) {
    res.status(409).json({ error: { code: "no_provider_configured", message: "Add a provider API key first." } });
    return;
  }
  try {
    const result = await openaiCompatibleAdapter.call({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: parsed.data.model ?? provider.model,
      systemPrompt: built.systemPrompt,
      userPrompt: built.userPrompt,
      structured: true,
      timeoutMs: 60_000,
    });
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
    // Try to parse tool-specific JSON; fall back to AgentTurnOutputSchema on failure.
    let toolJson: unknown;
    try {
      toolJson = JSON.parse(result.text);
    } catch {
      const m = result.text.indexOf("{");
      const e = result.text.lastIndexOf("}");
      if (m >= 0 && e > m) {
        try { toolJson = JSON.parse(result.text.slice(m, e + 1)); } catch { toolJson = null; }
      }
    }
    // Always also produce a friendly AgentTurnOutput-shaped fallback so the UI has a stable contract.
    const agent = AgentTurnOutputSchema.safeParse(toolJson);
    const finalToolJson = toolJson ?? { raw: result.text };
    res.json({
      tool: parsed.data.tool,
      result: finalToolJson,
      agentOutput: agent.success ? agent.data : null,
      usage: result.usage,
      warnings: result.warnings,
      rawText: result.text,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error("tool run failed", { tool: parsed.data.tool, userId: user.id, message });
    res.status(500).json({ error: { code: "internal", message } });
  }
});
