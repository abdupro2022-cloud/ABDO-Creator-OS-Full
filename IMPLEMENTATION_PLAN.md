# IMPLEMENTATION_PLAN — ABDO Creator OS

## Phase map

| Phase | Scope | Status | Deliverable |
|---|---|---|---|
| 1 | Foundation + Vertical Slice | ✅ **COMPLETE** | Working monorepo, auth, DB, provider config, one real AI call, i18n+RTL, design tokens, tests, handoff |
| 2 | AI Orchestration | ✅ **COMPLETE** | 5-role orchestrator with checkpoints, project-scoped conversations, trace UI, cancel + retry |
| 3 | Creator Tools | ✅ **COMPLETE** | Research adapters (SerpAPI/Tavily BYOK), YouTube oEmbed + transcript analysis, Script Studio with revisions, content tools registry (7 distinct tools) |
| 4 | Configuration & Extensibility | ✅ **COMPLETE** | Community publishing + moderation, password recovery (secure tokens), AI help assistant (docs-scoped), settings polish |
| 5 | Verification & Delivery | ✅ **COMPLETE** | README, .env.example, deployment guide, extension guides, final test sweep |

## Phase 1 plan — detailed

### P1.1 Bootstrap (this run)
- Persistent state docs ✅
- Root `package.json` (npm workspaces)
- `.env.example`
- `shared/` types + Zod schemas
- `server/` Express + TS + SQLite + migrations + auth + crypto + provider registry + agent orchestrator (single-pass chat for vertical slice) + skills validator
- `client/` Vite + React + TS + i18n + RTL + design tokens + all pages (real or honest empty)
- `tests/` Vitest suites
- Boot script: `npm install`, `npm run dev` (concurrent server + client), `npm test`

### P1.2 Vertical slice (this run)
- User signs up
- User configures an OpenAI-compatible provider with a personal API key (key encrypted at rest)
- User opens AI Assistant, types a prompt, server calls the configured provider with a Zod-validated structured-output contract, server returns the parsed result
- If no key configured, server returns a clear "no provider configured" error and the UI shows a CTA to the Providers page
- The same prompt is the input to a stub Advocate role that produces a Zod-validated proposal — the multi-agent orchestration structure is real; full 5-role flow lives in Phase 2

### P1.3 Tests (this run)
- Crypto round-trip
- Provider adapter contract (mock HTTP)
- Skill validator rejects unsafe defs
- Auth flow
- Cross-user data isolation
- Build smoke (server + client)

### P1.4 Handoff (this run)
- All Phase 1 todos closed or honestly documented
- Phase 1 handoff section in `TEST_RESULTS.md`
- Phase 2 plan refined

## Phase 2 plan — AI Orchestration (preview)

- 5-role workflow engine with dependencies (Advocate → Critic → Synthesizer → Business Analyst → Final Reviewer)
- Real handoffs: Critic receives Advocate's proposal; Synthesizer receives both; BA receives Synthesizer's; Reviewer receives BA's + the original task
- Bounded repair on invalid Zod output (1 retry with explicit repair prompt, then fail-stop)
- Task checkpoints: serialize completed steps so resume doesn't rerun
- Trace UI: expandable timeline of agent activity, final deliverable prominent
- Task classification: simple prompts may bypass the 5-role flow and use a single-agent fast path
- Per-task cancel, per-step retry, idempotency key

## Phase 3 plan — Creator Tools (preview)

- Research: web search adapter (SerpAPI or Tavily — byok) + content extraction adapter (Firecrawl or fetch+trafilatura fallback) + claim↔evidence graph + fact-check report
- Script Studio: project-scoped scripts, revision diff, hook/intro reviewer, audience engagement analysis, factual claim flagging, title/description generator, export (Markdown, plain text)
- YouTube: video metadata + transcript via oEmbed + transcript providers (Supadata/Apify) — byok
- Content tools: idea dev, audience analysis, planning, topic discovery, rewriting, summarization, repurposing, SEO qualitative, competitor qualitative, content-gap, content extraction, fact-check — each as a distinct workflow with its own Zod contract

## Phase 4 plan — Configuration & Extensibility (preview)

- Supabase swap-in: `db` adapter interface; existing `better-sqlite3` implementation stays, new `supabase` implementation mirrors the same query methods
- Password recovery via signed token (or SMTP if user configures)
- Community: published/draft/pending/rejected/removed states; ownership + visibility
- AI help assistant: scoped to docs only, no user-data access
- Settings: theme, default provider per agent, fallback chain, usage display

## Phase 5 plan — Verification & Delivery (preview)

- Run full Vitest suite + (if available) Playwright e2e
- Boot server + client together, walk through the 5-role workflow UI on a real key
- Document every requirement as VERIFIED or BLOCKED with a reason
- README, .env.example, deployment instructions, provider/Skill/workflow extension guides, troubleshooting

## Risks

- **R1** No live provider call in this sandbox → all real LLM paths are real code but cannot be exercised here. Will be honest about that in test results.
- **R2** SQLite vs Supabase → architectural seam in `db.ts` so swap is mechanical. Deferring Supabase is a Phase 4 task.
- **R3** No background workers → workflows run in-request. Resumability architecture is in place; full resume is Phase 2.
- **R4** No SMTP → password recovery deferred to Phase 4. For now password reset is out-of-band (admin would rotate).
- **R5** i18n string drift → all UI strings live in `i18n/en.json` and `i18n/ar.json`; new strings must be added to both.

## Credit discipline

- One pass per file unless the patch is small.
- Reuse the registry pattern for providers, skills, agents — don't write bespoke dispatch.
- Deterministic tests over live network calls in CI; live network calls only behind an explicit env flag.
- No npm reinstall unless a dep actually changes.
