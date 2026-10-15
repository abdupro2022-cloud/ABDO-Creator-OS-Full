# ABDO Creator OS

An AI-powered operating system for content creators. **Designed to deploy from an Android phone** — see `DEPLOY-ANDROID.md` for the 5-step guide.

## Status

All 5 phases complete. 33 server tests + 2 client tests pass; both builds clean.

## What works

- **Auth**: sign-up, sign-in, sign-out, JWT session, password recovery (secure single-use tokens)
- **Provider registry**: 13 providers (10 implemented, 3 honestly flagged). BYOK with AES-256-GCM encryption
- **AI Assistant**: single-role fast chat with bounded repair
- **AI Workflows**: real 5-role orchestrator (Advocate → Critic → Synthesizer → Business Analyst → Final Reviewer) with intermediate handoffs, step checkpoints, trace UI, cancellation
- **Project CRUD** + **Conversations** scoped to projects and owners
- **Skills system**: validator rejects unsafe definitions; community publishing with admin moderation
- **Research**: persistence + live web search (SerpAPI or Tavily BYOK)
- **YouTube**: oEmbed video info (no key) + transcript analysis with LLM
- **Script Studio**: project-scoped scripts with automatic revision history
- **7 distinct content tools** (idea dev, summary, rewrite, SEO outline, audience analysis, repurpose, YouTube outline)
- **AI Help Assistant** scoped to documentation catalog
- **Full Arabic + English i18n** with proper **RTL** layout
- **Single-binary deploy**: the server serves the built client as static files + API

## Quick start (developer machine)

```bash
npm install
npm run build:shared
npm run dev               # server :4000 + client :5173
```

## Deploy from an Android phone (no computer)

**Quick path: see [DEPLOY-ANDROID.md](DEPLOY-ANDROID.md) — 5 steps, no Termux, no local Node.js.**

Full deployment reference: see [DEPLOY.md](DEPLOY.md).

Paths supported:
- **Render.com Blueprint** (`render.yaml`) — recommended
- **Docker** (any container host) — `Dockerfile` + `docker-compose.yml`
- **Railway / Fly.io** — Dockerfile path

## Architecture

```
abdo-creator-os/
├── shared/           Zod schemas + TS types shared between client and server
├── server/           Express + TypeScript
│   ├── src/
│   │   ├── auth/         bcrypt + JWT + recovery
│   │   ├── crypto/       AES-256-GCM envelope
│   │   ├── routes/       auth, projects, providers, agents, workflows, conversations,
│   │   │                 skills, research, research/search, youtube, scripts, tools,
│   │   │                 community, help, preferences, usage
│   │   ├── services/
│   │   │   ├── providers/    registry + OpenAI-compatible adapter
│   │   │   ├── agents/       5-role orchestrator with bounded repair
│   │   │   └── skills/       validator
│   │   └── db.ts          better-sqlite3 + migrations
│   └── migrations/    005 ordered SQL files
├── client/           Vite + React + TypeScript
│   └── src/           19 pages, i18n (en + ar), design tokens, components
├── render.yaml       Render Blueprint
├── Dockerfile        Multi-stage container build
├── docker-compose.yml
├── Procfile          Heroku-style
├── app.json          Platform manifest
├── .env.example      No real secrets
├── DEPLOY.md         Full deploy reference
├── DEPLOY-ANDROID.md 5-step phone-only guide
└── *.md              persistent state docs
```

## Configuration

See [`.env.example`](.env.example). The most important variable is `APP_KEK` — the 32-byte (64 hex char) key that encrypts provider API keys at rest. **If you lose it, all stored provider keys are lost.**

## Testing

```bash
npm test               # 33 server tests
npm run test:client    # 2 client tests
```

## Honest limitations

- **No live LLM call in this sandbox** because no provider key is available. The full request/response path is real code, tested with mocked HTTP. To verify end-to-end, add your own key in the UI.
- **Local SQLite** in this environment; Supabase swap-in is a documented architectural seam (AD-015).
- **Live web search** uses SerpAPI or Tavily (both require user-supplied keys).
- **YouTube transcripts**: the oEmbed video-info path needs no key; transcript analysis requires the user to paste a transcript. Adding an automated transcript provider is a single new case in `server/src/routes/youtube.ts`.
- **Anthropic, Google Gemini, Cohere** are listed in the catalog as "not yet implemented" honestly.

## Persistent state docs

- `PROJECT_STATE.md` — current status, handoff notes
- `REQUIREMENTS_CHECKLIST.md` — per-requirement status
- `IMPLEMENTATION_PLAN.md` — 5-phase plan (all COMPLETE)
- `ARCHITECTURE_DECISIONS.md` — 15 ADs with rejected alternatives
- `TEST_RESULTS.md` — 86 verifications recorded
- `MASTER_REQUIREMENTS.md` — full §1–25 spec
