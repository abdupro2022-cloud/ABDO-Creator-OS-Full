import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { ResearchReport, ResearchSource, ResearchClaim } from "@abdo/shared";
import { db } from "../db.js";
import { requireAuth } from "../auth/middleware.js";

export const researchRouter: Router = Router();

/**
 * Research reports. Phase 1 ships the persistence + contract; live web-search
 * and content-extraction adapters arrive in Phase 3 when a research-provider
 * key (SerpAPI / Tavily) and an extraction provider key are configured.
 *
 * Users can already create a research report by submitting sources and claims
 * directly — useful for fact-checking workflows and for ingesting manually
 * gathered evidence.
 */

const CreateReportSchema = z.object({
  query: z.string().min(1).max(500),
  summary: z.string().min(1).max(20_000),
  sources: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
      publicationDate: z.string().nullable().optional(),
      retrievedAt: z.string().optional(),
      reliability: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
      notes: z.string().optional(),
      excerpt: z.string().optional(),
    }),
  ),
  claims: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      status: z.enum([
        "verified",
        "supported",
        "unverified",
        "conflicting",
        "inference",
        "speculation",
      ]),
      supportingSourceUrls: z.array(z.string().url()).default([]),
      conflictingSourceUrls: z.array(z.string().url()).default([]),
      notes: z.string().optional(),
    }),
  ),
  factCheckNotes: z.array(z.string()).default([]),
});

researchRouter.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  const rows = db
    .prepare(
      `SELECT id, query, summary, sources_json as sourcesJson, claims_json as claimsJson,
              fact_check_notes_json as factCheckNotesJson, created_at as createdAt
       FROM research_reports WHERE owner_id = ? ORDER BY created_at DESC`,
    )
    .all(user.id) as Array<{
      id: string;
      query: string;
      summary: string;
      sourcesJson: string;
      claimsJson: string;
      factCheckNotesJson: string;
      createdAt: string;
    }>;
  const reports: ResearchReport[] = rows.map((r) => ({
    id: r.id,
    query: r.query,
    summary: r.summary,
    sources: JSON.parse(r.sourcesJson) as ResearchSource[],
    claims: JSON.parse(r.claimsJson) as ResearchClaim[],
    factCheckNotes: JSON.parse(r.factCheckNotesJson) as string[],
    createdAt: r.createdAt,
  }));
  res.json({ reports });
});

researchRouter.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_input", message: "Invalid report.", details: parsed.error.flatten() } });
    return;
  }
  const id = nanoid();
  const now = new Date().toISOString();
  const sourcesWithTimestamp = parsed.data.sources.map((s) => ({
    ...s,
    publicationDate: s.publicationDate ?? null,
    retrievedAt: s.retrievedAt ?? now,
  }));
  db.prepare(
    `INSERT INTO research_reports
     (id, owner_id, query, summary, sources_json, claims_json, fact_check_notes_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    user.id,
    parsed.data.query,
    parsed.data.summary,
    JSON.stringify(sourcesWithTimestamp),
    JSON.stringify(parsed.data.claims),
    JSON.stringify(parsed.data.factCheckNotes),
    now,
  );
  const report: ResearchReport = {
    id,
    query: parsed.data.query,
    summary: parsed.data.summary,
    sources: sourcesWithTimestamp,
    claims: parsed.data.claims,
    factCheckNotes: parsed.data.factCheckNotes,
    createdAt: now,
  };
  res.status(201).json({ report });
});

researchRouter.get("/:id", requireAuth, (req, res) => {
  const user = req.user!;
  const row = db
    .prepare(
      `SELECT id, query, summary, sources_json as sourcesJson, claims_json as claimsJson,
              fact_check_notes_json as factCheckNotesJson, created_at as createdAt
       FROM research_reports WHERE id = ?`,
    )
    .get(req.params.id) as
    | {
        id: string;
        query: string;
        summary: string;
        sourcesJson: string;
        claimsJson: string;
        factCheckNotesJson: string;
        createdAt: string;
        owner_id: string;
      }
    | undefined;
  if (!row || (row as unknown as { owner_id: string }).owner_id !== user.id) {
    res.status(404).json({ error: { code: "not_found", message: "Report not found." } });
    return;
  }
  const report: ResearchReport = {
    id: row.id,
    query: row.query,
    summary: row.summary,
    sources: JSON.parse(row.sourcesJson),
    claims: JSON.parse(row.claimsJson),
    factCheckNotes: JSON.parse(row.factCheckNotesJson),
    createdAt: row.createdAt,
  };
  res.json({ report });
});

/** Live web search is now implemented in `routes/researchSearch.ts` (SerpAPI + Tavily BYOK). */
