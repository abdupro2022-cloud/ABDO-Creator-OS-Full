import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { request } from "undici";
import { requireAuth } from "../auth/middleware.js";
import { resolveProviderForUser } from "./providers.js";
import { openaiCompatibleAdapter, ProviderError } from "../services/providers/openaiCompatible.js";
import { db } from "../db.js";
import { logger } from "../logger.js";

export const youtubeRouter: Router = Router();

/**
 * YouTube tools.
 *
 * - `oembed` requires no API key and returns video title, author, thumbnail.
 *   Used as a free channel/video info source.
 * - Transcripts: we NEVER fabricate one. The user can paste a transcript,
 *   which we then analyze via the configured LLM.
 *
 * If a future deployment adds a transcript provider (Apify, Supadata, etc.),
 * wire it here behind a config flag — but never claim success without
 * actually retrieving it.
 */

const VideoIdInput = z.object({ url: z.string().url().or(z.string().regex(/^[A-Za-z0-9_-]{11}$/)) });

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Bare 11-char id
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  // Common URL forms
  const m = trimmed.match(/(?:v=|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const last = trimmed.split("/").filter(Boolean).pop();
  if (last && /^[A-Za-z0-9_-]{11}$/.test(last)) return last;
  return null;
}

youtubeRouter.post("/oembed", requireAuth, async (req, res) => {
  const parsed = VideoIdInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Provide a YouTube URL or 11-char video id." } });
    return;
  }
  const id = extractVideoId(parsed.data.url);
  if (!id) {
    res.status(400).json({ error: { code: "invalid_input", message: "Could not extract a video id." } });
    return;
  }
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    const r = await request(oembedUrl, { headersTimeout: 10_000, bodyTimeout: 10_000 });
    if (r.statusCode >= 400) {
      const text = await r.body.text();
      res.status(400).json({ error: { code: "oembed_failed", message: `oEmbed returned ${r.statusCode}: ${text.slice(0, 200)}` } });
      return;
    }
    const data = JSON.parse(await r.body.text()) as { title: string; author_name: string; author_url: string; thumbnail_url: string; provider_name: string };
    res.json({ videoId: id, title: data.title, authorName: data.author_name, authorUrl: data.author_url, thumbnailUrl: data.thumbnail_url, provider: data.provider_name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("youtube oembed failed", { message });
    res.status(502).json({ error: { code: "upstream", message } });
  }
});

const TranscriptInput = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  transcript: z.string().min(20).max(200_000),
});

youtubeRouter.post("/transcript", requireAuth, async (req, res) => {
  const parsed = TranscriptInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Provide a 11-char video id and a transcript of 20-200k chars.", details: parsed.error.flatten() } });
    return;
  }
  const provider = resolveProviderForUser(req.user!.id);
  if (!provider) {
    res.status(409).json({ error: { code: "no_provider_configured", message: "Add a provider API key to analyze the transcript." } });
    return;
  }
  try {
    const result = await openaiCompatibleAdapter.call({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      systemPrompt: "You are a YouTube transcript analyst. Return a JSON object with fields: keyPoints (5-8 short strings), topics (3-6 strings), structure (array of {label, beats: string[]}), improvements (3-5 strings). Be faithful to the transcript; do not invent quotes or facts not in the text.",
      userPrompt: `Analyze the following transcript:\n\n${parsed.data.transcript.slice(0, 80_000)}`,
      structured: true,
      timeoutMs: 60_000,
    });
    db.prepare(
      `INSERT INTO usage_records (id, user_id, provider_config_id, model, prompt_tokens, completion_tokens, total_tokens, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      nanoid(),
      req.user!.id,
      provider.configId,
      provider.model,
      result.usage.promptTokens,
      result.usage.completionTokens,
      result.usage.totalTokens,
      result.usage.source,
      new Date().toISOString(),
    );
    res.json({ videoId: parsed.data.videoId, analysis: result.text, usage: result.usage });
  } catch (err) {
    if (err instanceof ProviderError) {
      res.status(400).json({ error: { code: err.code, message: err.message } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { code: "internal", message } });
  }
});
