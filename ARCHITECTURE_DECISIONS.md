# ARCHITECTURE_DECISIONS — ABDO Creator OS

Each decision records: what was chosen, what was rejected, why, and the consequence.

## AD-001: Vite + React + TypeScript (client)

**Chosen**: Vite + React 18 + TypeScript.
**Rejected**: Next.js (unnecessary SSR for local-first SPA; RSC adds complexity for no Phase 1 benefit), CRA (deprecated), Svelte (smaller component ecosystem for the size of this UI).
**Why**: Fast dev cycle, mature ecosystem, typed components, and the team has a large body of well-maintained React UI libraries (e.g. react-router, zustand, react-i18next).
**Consequence**: SPA with a separate API server. Requires CORS configuration in development; no SSR-rendered HTML for crawlers (not a requirement).

## AD-002: Express + TypeScript (server)

**Chosen**: Node 22 + Express 4 + TypeScript.
**Rejected**: Fastify (similar but slightly heavier type dance for our routes), Hono (smaller community), Deno (different runtime), serverless functions (no scheduled jobs / cron in sandbox).
**Why**: Mature middleware ecosystem, the widest set of battle-tested auth/db/logging packages, runs in any Node environment, easy to deploy to a VM or container.
**Consequence**: Synchronous request/response model. Background workers deferred.

## AD-003: better-sqlite3 (DB)

**Chosen**: SQLite via better-sqlite3 (synchronous, file-based, zero-config).
**Rejected**: PostgreSQL (no server in sandbox), in-memory only (loses data on restart), JSON files (no transactions), LowDB (not type-safe at scale).
**Why**: Real database with proper transactions, foreign keys, indexes, and migrations. Zero external services. Production-shaped schema that can be ported to PostgreSQL with minimal changes.
**Consequence**: No RLS (Row Level Security) — authorization enforced at the application layer. Architecture includes a `db` interface so a Supabase/Postgres implementation can be added in Phase 4 without touching route handlers.

## AD-004: Zod (validation)

**Chosen**: Zod for all contracts (request bodies, agent outputs, skill definitions, provider configs).
**Rejected**: Joi (less TypeScript-native), Yup (older API), JSON Schema (extra build step), TypeBox (smaller community).
**Why**: Single source of truth for type + runtime validation. First-class TypeScript inference. `safeParse` for bounded repair.
**Consequence**: All API boundaries parse with Zod; invalid input is rejected with structured error messages.

## AD-005: AES-256-GCM (credential encryption)

**Chosen**: AES-256-GCM via Node's built-in `crypto`.
**Rejected**: Plaintext (would violate §5), bcrypt (wrong primitive — for passwords, not at-rest encryption), libsodium (extra dep, no benefit for this use case).
**Why**: Built-in to Node, authenticated encryption (detects tampering), standard envelope (iv || tag || ciphertext).
**Consequence**: A `KEK` (Key Encryption Key) is loaded from `APP_KEK` env or auto-generated to `.data/master.key` for dev. Production deployments must set `APP_KEK` (hex) and back it up out-of-band. **A lost KEK loses all stored keys — this is honest and expected.**

## AD-006: Local auth (bcrypt + JWT)

**Chosen**: bcrypt (12 rounds) for password hashing, JWT (HS256) for session tokens.
**Rejected**: Sessions in DB (more state, no real benefit at this scale), OAuth (requires external provider), magic links (requires email).
**Why**: Self-contained, no external dependencies, works in any environment.
**Consequence**: Password recovery via email deferred to Phase 4. No password rotation flow yet.

## AD-007: Provider registry (OpenAI-compatible first)

**Chosen**: A `ProviderAdapter` interface; concrete `openaiCompatible` implementation handles OpenAI, OpenRouter, DeepSeek, Together, Groq, OpenAI-compatible custom endpoints, etc.
**Rejected**: One adapter per provider (would be 10+ near-duplicate files for the first version).
**Why**: Many providers now expose an OpenAI-compatible `/v1/chat/completions` endpoint. One adapter covers the majority. Provider-specific adapters can be added later for the ones that don't (Anthropic, Gemini, Cohere) without touching the registry.
**Consequence**: For providers without an OpenAI-compatible surface, the UI shows them in the catalog as "not yet implemented" honestly. Users can add custom OpenAI-compatible providers themselves.

## AD-008: Agent contracts in Zod

**Chosen**: Each of the 5 roles has a Zod schema for its output. The orchestrator does `safeParse`; on failure, one bounded repair retry with an explicit "fix this JSON to match the schema" prompt; if it still fails, mark the step failed and surface to the UI.
**Rejected**: Free-form text parsing (fragile, violates §10), LLM tool-calling to enforce schema (extra provider capability requirement).
**Why**: Honest, deterministic validation. Repair is bounded to 1 attempt to avoid credit waste.
**Consequence**: Output schemas are explicit. Adding a new role = adding a new schema.

## AD-009: i18n with react-i18next + RTL toggle

**Chosen**: react-i18next for en + ar; the `<html dir>` attribute drives CSS `[dir="rtl"]` overrides.
**Rejected**: Custom i18n (more code, less proven), FormatJS (heavier API for the use case).
**Why**: Mature, hooks-based, supports namespaces + lazy loading.
**Consequence**: Every new UI string must be added to both `en.json` and `ar.json` (or shown as the key). The `LangToggle` switches language + direction atomically.

## AD-010: Design tokens from ui-ux-pro-max

**Chosen**: AI/Chatbot palette (primary `#7C3AED`, secondary `#A78BFA`, CTA `#06B6D4`, bg `#FAF5FF`, text `#1E1B4B`, border `#DDD6FE`) with `Space Grotesk` headings + `DM Sans` body.
**Why**: Matches the AI-assistant surface the product ships. Modern/tech pairing, dark-mode friendly.
**Consequence**: Tokens are in `client/src/design/tokens.css` and used by every component. No ad-hoc colors.

## AD-011: No background workers in Phase 1

**Chosen**: In-request workflow execution with a configurable per-request timeout.
**Rejected**: BullMQ + Redis (requires Redis in sandbox), pg-boss (requires Postgres), node-cron for polling (extra moving parts).
**Why**: Phase 1 needs a working vertical slice, not infrastructure. The orchestrator is structured so adding a worker later is a refactor of one file.
**Consequence**: A 5-role run with retries can take 30–60s synchronously. UI shows a progress indicator.

## AD-012: BYOK (bring your own key) only

**Chosen**: Users must add their own provider API keys. There is no admin-provided global key.
**Rejected**: Bundled key (security, abuse, cost).
**Why**: The user spec demands that users have freedom to choose providers and that personal keys must not bleed across users. BYOK is the simplest expression of that.
**Consequence**: First-time users hit the Providers page before they can use AI features. The UI makes this a guided 2-step flow, not a dead end.

## AD-013: Tool registry (not "renamed generic prompt")

**Chosen**: Each creator tool (Script Studio, Research, Idea Dev, SEO, etc.) is a discrete workflow with its own inputs, contract, and persistence — registered in `tools/registry.ts`.
**Rejected**: A single LLM call with a different system prompt per tool (violates §13).
**Why**: Each tool has real differences — Script Studio needs revision history, Research needs source/evidence contracts, YouTube needs transcript handling. A registry makes the differences explicit and testable.
**Consequence**: Adding a tool = adding a registry entry + a page. No central mega-prompt.

## AD-014: Logs redact secrets

**Chosen**: A small `logger.ts` wraps `console` and scrubs `api_key`, `authorization`, `password`, `token`, `cookie` from stringified output.
**Why**: §20 mandates that logs exclude API keys, passwords, tokens, sensitive content.
**Consequence**: Logs are safe to share. Application still enforces the actual secret boundaries — the logger is defense in depth, not the only line.

## AD-015: Defer Supabase to Phase 4

**Chosen**: Local SQLite in Phase 1; document Supabase swap-in path in `ARCHITECTURE_DECISIONS.md` and `IMPLEMENTATION_PLAN.md`.
**Why**: No Supabase CLI / project in sandbox. Forcing Supabase into Phase 1 would mean either fabricating connection strings (forbidden) or blocking Phase 1 entirely.
**Consequence**: The `db` module is interface-driven. A future Supabase implementation can mirror the existing query methods without touching route handlers. RLS-equivalent checks stay in the application layer for now.
