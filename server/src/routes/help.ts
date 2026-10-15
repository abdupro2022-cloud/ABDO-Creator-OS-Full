import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { resolveProviderForUser } from "./providers.js";
import { openaiCompatibleAdapter, ProviderError } from "../services/providers/openaiCompatible.js";
import { nanoid } from "nanoid";
import { logger } from "../logger.js";

export const helpRouter: Router = Router();

/**
 * Contextual help system.
 *
 * The static docs are served from `/api/help/docs` (always works, no key).
 * The AI help assistant is a real LLM call that is explicitly scoped to documentation
 * (no user data, no project data, no provider keys beyond the BYOK authorization
 * already granted by the user's session).
 */

const DOCS: Array<{ id: string; title: string; body: string }> = [
  {
    id: "providers",
    title: "Providers & Models",
    body:
      "ABDO Creator OS supports any OpenAI-compatible endpoint. Go to Providers & Models, click Add provider, pick a provider from the catalog, paste your key, and (optionally) override the base URL and default model. The architecture supports adding Anthropic, Google Gemini, and Cohere as provider-specific adapters in a later phase.",
  },
  {
    id: "assistant",
    title: "AI Assistant",
    body:
      "The AI Assistant uses the Advocate role by default and returns a structured proposal (summary, key points, recommendations, risks, confidence, next actions). For complex tasks, run a full 5-role workflow from the Workflow page.",
  },
  {
    id: "workflows",
    title: "Workflows (5-role)",
    body:
      "Workflows run Advocate → Critic → Synthesizer → Business Analyst → Final Reviewer. Each step's output becomes the next step's input. The task is a real multi-agent process; the final Reviewer's output is the deliverable.",
  },
  {
    id: "research",
    title: "Research",
    body:
      "Create research reports by hand from sources and claims (Phase 1). Each claim has a status: verified, supported, unverified, conflicting, inference, speculation. The fact-checker workflow identifies unsupported claims. Live web search (SerpAPI/Tavily) and page extraction (Firecrawl) are Phase 3.",
  },
  {
    id: "scripts",
    title: "Script Studio",
    body:
      "Create scripts with hook, body, outro. Each save creates a revision you can review. Assign scripts to projects to keep your work organized.",
  },
  {
    id: "skills",
    title: "Skills",
    body:
      "Skills are reusable, versioned, declarative capabilities. Built-in Skills are seeded. You can create your own. The server rejects Skill definitions that try to execute code or contain shell patterns. The system prompt is treated as untrusted input.",
  },
  {
    id: "security",
    title: "Security & API keys",
    body:
      "Your provider API keys are encrypted at rest with AES-256-GCM. They never appear in client-side code, public database records, or logs. The encryption key is loaded from the APP_KEK environment variable (or auto-generated for development).",
  },
];

helpRouter.get("/docs", requireAuth, (_req, res) => {
  res.json({ docs: DOCS });
});

helpRouter.get("/docs/:id", requireAuth, (req, res) => {
  const doc = DOCS.find((d) => d.id === req.params.id);
  if (!doc) {
    res.status(404).json({ error: { code: "not_found", message: "Doc not found." } });
    return;
  }
  res.json({ doc });
});

/**
 * AI help assistant.
 *
 * Strictly scoped: the model is given the doc catalog and the user's question.
 * It does NOT have access to the user's projects, conversations, provider keys,
 * skills, or any other user data. This is enforced by the system prompt.
 */
helpRouter.post("/ask", requireAuth, async (req, res) => {
  const user = req.user!;
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 2000) {
    res.status(400).json({ error: { code: "invalid_input", message: "Provide a question between 1 and 2000 chars." } });
    return;
  }
  const provider = resolveProviderForUser(user.id);
  if (!provider) {
    res.status(409).json({ error: { code: "no_provider_configured", message: "Add a provider API key to use the AI help assistant." } });
    return;
  }
  const docsList = DOCS.map((d) => `- [${d.id}] ${d.title}: ${d.body}`).join("\n");
  const systemPrompt = `You are the ABDO Creator OS help assistant.

You are STRICTLY scoped to the documentation below. You may not invent features, settings, or behavior that is not documented. If the user asks something the docs do not cover, say so honestly and point them to the closest doc.

You do NOT have access to the user's projects, conversations, skills, provider keys, or any other user data. If asked, refuse and explain that you only have access to the docs.

Respond in a JSON object with exactly these fields and no other text:
{
  "answer": string,           // 2-6 sentence answer in the same language as the question
  "docReferences": string[],  // ids of the docs that informed the answer
  "confidence": number,       // 0.0 to 1.0
  "outOfScope": boolean       // true if the question is not covered by the docs
}

Documentation catalog:
${docsList}`;
  try {
    const result = await openaiCompatibleAdapter.call({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      systemPrompt,
      userPrompt: question,
      structured: true,
      timeoutMs: 30_000,
    });
    db.prepare(
      `INSERT INTO usage_records (id, user_id, provider_config_id, model, prompt_tokens, completion_tokens, total_tokens, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      nanoid(),
      user.id,
      provider.configId,
      provider.model,
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens,
      result.usage.source,
      new Date().toISOString(),
    );
    res.json({ answer: result.text, usage: result.usage });
  } catch (err) {
    if (err instanceof ProviderError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error("help.ask failed", { userId: user.id, message });
    res.status(500).json({ error: { code: "internal", message } });
  }
});
