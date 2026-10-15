import { Router } from "express";
import { z } from "zod";
import { request } from "undici";
import { requireAuth } from "../auth/middleware.js";
import { logger } from "../logger.js";

export const researchSearchRouter: Router = Router();

/**
 * Live web search.
 *
 * Supports SerpAPI and Tavily. The user provides the API key via env or
 * per-request. Without a key, returns a 409 with a clear actionable message.
 *
 * Architecture is intentionally minimal: one endpoint, one provider per call.
 * Other providers (Bing, Brave, Google CSE) can be added behind the same
 * `provider` parameter.
 */

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  provider: z.enum(["serpapi", "tavily"]).default("tavily"),
  apiKey: z.string().min(1).optional(),
  numResults: z.number().int().min(1).max(20).default(8),
});

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publicationDate: string | null;
}

async function searchSerpApi(query: string, apiKey: string, numResults: number): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${numResults}&api_key=${encodeURIComponent(apiKey)}`;
  const r = await request(url, { headersTimeout: 15_000, bodyTimeout: 15_000 });
  if (r.statusCode >= 400) {
    throw new Error(`SerpAPI returned ${r.statusCode}`);
  }
  const data = JSON.parse(await r.body.text()) as { organic_results?: Array<{ title: string; link: string; snippet?: string; date?: string }> };
  return (data.organic_results ?? []).map((it) => ({
    title: it.title,
    url: it.link,
    snippet: it.snippet ?? "",
    publicationDate: it.date ?? null,
  }));
}

async function searchTavily(query: string, apiKey: string, numResults: number): Promise<SearchResult[]> {
  const r = await request("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: numResults, include_answer: false }),
    headersTimeout: 15_000,
    bodyTimeout: 15_000,
  });
  if (r.statusCode >= 400) {
    throw new Error(`Tavily returned ${r.statusCode}`);
  }
  const data = JSON.parse(await r.body.text()) as { results?: Array<{ title: string; url: string; content: string; published_date?: string }> };
  return (data.results ?? []).map((it) => ({
    title: it.title,
    url: it.url,
    snippet: it.content,
    publicationDate: it.published_date ?? null,
  }));
}

researchSearchRouter.post("/search", requireAuth, async (req, res) => {
  const parsed = SearchInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid search request.", details: parsed.error.flatten() } });
    return;
  }
  // Per-request key takes precedence; env fallback
  const envKey = process.env[`RESEARCH_${parsed.data.provider.toUpperCase()}_KEY`];
  const apiKey = parsed.data.apiKey ?? envKey;
  if (!apiKey) {
    res.status(409).json({
      error: {
        code: "research_provider_not_configured",
        message: `Provide a ${parsed.data.provider} key either per-request (apiKey field) or via the RESEARCH_${parsed.data.provider.toUpperCase()}_KEY env var.`,
      },
    });
    return;
  }
  try {
    const results = parsed.data.provider === "serpapi"
      ? await searchSerpApi(parsed.data.query, apiKey, parsed.data.numResults)
      : await searchTavily(parsed.data.query, apiKey, parsed.data.numResults);
    res.json({ provider: parsed.data.provider, query: parsed.data.query, results, retrievedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("research search failed", { provider: parsed.data.provider, message });
    res.status(502).json({ error: { code: "upstream", message } });
  }
});
