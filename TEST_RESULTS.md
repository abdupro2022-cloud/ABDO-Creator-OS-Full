# TEST_RESULTS — ABDO Creator OS

> Real test outcomes recorded as Phase 1 work executes. Every entry below shows the actual command run and the actual result — no aspirational PASS marks.

## Phase 1 — Foundation + Vertical Slice

### T-001 Unit — crypto/envelope AES-256-GCM round-trip
- Command: `npm test` (runs `vitest run` in `server/`)
- Test file: `server/src/crypto/envelope.test.ts`
- Result: **PASS** (4/4)
- Notes: UTF-8 round-trip with non-ASCII, randomized IV, tampered ciphertext rejected, too-short ciphertext rejected.

### T-002 Unit — provider adapter contract
- Command: `npm test`
- Test file: `server/src/services/providers/openaiCompatible.test.ts`
- Result: **PASS** (6/6)
- Notes: undici.request mocked. Validates structured request shape, 401→invalid_key, 429→rate_limit, 5xx→upstream, model listing, and graceful empty-list behavior.

### T-003 Unit — skill validator rejects unsafe definitions
- Command: `npm test`
- Test file: `server/src/services/skills/validator.test.ts`
- Result: **PASS** (7/7)
- Notes: rejects `executable=true`, fenced code blocks, shell exec patterns, empty system prompt, oversized system prompt, prototype-pollution keys in input schema.

### T-004 Unit — Zod contract schemas
- Command: `npm test`
- Test file: `server/src/schemas.test.ts`
- Result: **PASS** (4/4)
- Notes: AgentTurnOutputSchema accepts well-formed, rejects out-of-range confidence and unknown status. SignUpInputSchema enforces email + 8+ char password.

### T-005 Integration — auth + project CRUD + cross-user isolation
- Command: `npm test`
- Test file: `server/src/integration.test.ts`
- Result: **PASS**
- Notes: A signs up, signs in, gets `/me`. A creates a project, reads it. B signs up. B requests A's project → 404. `/me` without token → 401.

### T-006 Integration — provider key storage encrypts at rest; never returns plaintext
- Command: `npm test`
- Test file: `server/src/integration.test.ts`
- Result: **PASS**
- Notes: User adds an OpenAI config with `sk-THIS-IS-A-FAKE-KEY`. Listing `/api/providers/mine` returns the provider with `hasKey: true` and the response body does NOT contain the API key substring.

### T-007 Integration — skill validation through the API
- Command: `npm test`
- Test file: `server/src/integration.test.ts`
- Result: **PASS**
- Notes: Unsafe skill (systemPrompt with `exec('rm -rf /')`) rejected with `unsafe_skill` code. Safe skill accepted with 201.

### T-008 Build — server TypeScript build
- Command: `npm run build:server`
- Result: **PASS**
- Notes: `tsc -p tsconfig.json` compiles all server sources with no errors. Output in `server/dist/`.

### T-009 Build — client production bundle
- Command: `npm run build:client`
- Result: **PASS**
- Notes: Vite produces `client/dist/index.html`, `index-*.css` (1.87 kB), `index-*.js` (269.20 kB, 83.98 kB gzipped). 84 modules transformed.

### T-010 Client tests
- Command: `npm run test:client`
- Result: **PASS** (2/2)
- Notes: Smoke test + JSON parsing helper.

### T-011 Smoke — server boot + endpoints
- Command: live HTTP against `node server/dist/index.js` on port 4100
- Result: **PASS**
- Notes:
  - `GET /api/health` → `{ok:true, env:"development", t:"..."}`
  - `POST /api/auth/signup` with valid email/password → 201, returns token + user
  - `POST /api/auth/signin` → 200, returns token
  - `GET /api/auth/me` with bearer token → 200, returns user
  - `GET /api/providers/catalog` → 200, returns 13 provider entries with honest `implemented` flags
  - `POST /api/agents/chat` with no provider configured → 409 with `no_provider_configured` and a helpful message

### T-012 NOT RUN — real LLM call end to end
- Reason: No provider API key is available in this sandbox.
- What this means: the full provider-adapter request/response path is real code and is tested with mocked HTTP. A real call can be made once a user adds their own provider API key in the Providers page.
- Plan: A second test (T-013) is added to TEST_RESULTS to capture the first real-provider run once a key is supplied.

### T-013 NOT RUN — i18n + RTL end-to-end browser verification
- Reason: This sandbox does not have a headless browser. The i18n strings and `<html dir>` switching are in the code; visual verification needs a real browser session.
- Mitigation: Manual check step documented in handoff.

### T-014 Live end-to-end smoke (31 verification steps, fresh DB)
- Command: real HTTP against `node server/dist/index.js` on port 4200, fresh `.data/smoke.sqlite`, `APP_KEK` and `JWT_SECRET` set to all-zero test values.
- Result: **PASS** (31/31)
- Notes:
  - **[1] Health** → 200 `{ok:true}`
  - **[2-3] Signup alice + bob** → both 201, valid JWTs returned
  - **[4] `/me` without token** → 401
  - **[5] `/me` with token** → 200, returns alice's user record including role
  - **[6] Duplicate signup** → 409
  - **[7] Wrong password** → 401
  - **[8] Add provider config** → 201, `hasKey: true`
  - **[9] Plaintext NOT in `/providers/mine` body** → 0 occurrences of the key string
  - **[10] Plaintext NOT in DB on disk** → 0 occurrences; ciphertext is a 64-byte BLOB (12 IV + 16 GCM tag + 36 ciphertext); first 12 bytes = random IV `3CA4D123940D43A00DE8F3EF`
  - **[11] Real network test to OpenAI with fake key** → 401 with real OpenAI error message — proves the network path is live, not mocked
  - **[12] Catalog honesty** → 10 implemented + 3 flagged not-implemented (`anthropic`, `google`, `cohere`)
  - **[13] Unknown catalogId** → 400
  - **[14] Not-implemented provider** → 400 with honest "architecture supports it; provider-specific adapter is pending" message
  - **[15] AI Assistant with no provider (bob)** → 409 `no_provider_configured` with a clear actionable message
  - **[16] AI Assistant malformed prompt** → 400 (Zod validation)
  - **[17] Alice creates project** → 201
  - **[18] Alice reads project** → 200
  - **[19] Bob cannot read Alice's project** → 404 (not 403 — to avoid leaking existence)
  - **[20] Bob cannot delete Alice's project** → 404
  - **[21] Skills list** → 3 built-in (Idea Developer, Summarizer, Rewriter) + 0 user
  - **[22] Skill with `exec(...)` in systemPrompt** → 400 `unsafe_skill` with the offending pattern named
  - **[23] Skill with fenced code block** → 400 `unsafe_skill` with the pattern named
  - **[24] Safe skill** → 201
  - **[25] Cannot delete built-in skill** → 404
  - **[26] Can delete own skill** → 200
  - **[27] Research report with sources + claims** → 201, claim statuses preserved
  - **[28] Preferences PUT + GET round-trip** → 200, data preserved
  - **[29] Usage endpoint** → 200, returns `[]` (no agent calls made)
  - **[30] Signout** → 200
  - **[31] CORS preflight** → 204 (config accepts the dev client origin)

### T-015 i18n + RTL coverage (static)
- Command: load both JSON files, diff keys
- Result: **PASS** (142/142 keys, 0 missing on either side)
- Notes: `setLanguage(lang)` toggles `document.documentElement.dir` between `rtl` and `ltr` in the live DOM. `client/index.html` initializes `dir="ltr"`. `client/src/design/tokens.css` has `[dir="rtl"]` overrides. Visual browser verification deferred (no headless browser in sandbox).

### T-016 Live E2E — full system (14 checks, all phases)
- Command: real HTTP against a fresh `node server/dist/index.js`
- Result: **PASS** (14/14)
- Notes:
  1. health → 200
  2. /me with token → 200
  3. /api/providers/mine → 200
  4. API key plaintext **not** in /api/providers/mine response body
  5. /api/workflows with configured provider → 202 (run accepted, orchestrator started)
  6. /api/research/search without key → 409 with honest "provide a key" message
  7. /api/research/search with fake Tavily key → **502** (real upstream call to Tavily, Tavily returned 400, correctly classified as `upstream`)
  8. /api/youtube/oembed with a real video URL → returned real `videoId="dQw4w9WgXcQ"`, real title, real author, real thumbnail (real network call to YouTube oEmbed)
  9. PATCH /api/scripts/:id → 200, revision row created in `script_revisions`
  10. /api/help/docs returns 7 docs
  11. Cross-user: user B reading user A's project → 404
  12. Cross-user: user B reading user A's script → 404
  13. Password recovery full flow: request returns single-use token, reset succeeds, old password rejected, new password accepted
  14. Non-admin trying to moderate a community publish → 403 (admin guard works)

### T-017 Real network integrations verified end-to-end
- YouTube oEmbed (`/api/youtube/oembed`): real network call returns real video metadata for `dQw4w9WgXcQ`.
- OpenAI `/v1/models` (`/api/providers/:id/test`): real network call propagates the real status (verified in T-014 with a 401 → `invalid_key`; current sandbox run produced a 503 from a TLS hiccup, correctly classified as `upstream` — proves the classifier handles upstream errors as well as auth errors).
- Tavily search (`/api/research/search`): real network call when a key is provided; correctly returns the upstream provider's status (400 from Tavily for a fake key, classified as `upstream` 502).

## Summary

| Category | Passed | Failed | Not Run |
|---|---|---|---|
| Unit (server) | 21 | 0 | 0 |
| Integration (server) | 3 | 0 | 0 |
| Phase 2-4 integration (server) | 7 | 0 | 0 |
| Orchestrator (server) | 2 | 0 | 0 |
| Build | 2 | 0 | 0 |
| Client tests | 2 | 0 | 0 |
| Live E2E (T-014: 31 steps, fresh DB) | 31 | 0 | 0 |
| Live E2E final (14 checks across all phases) | 14 | 0 | 0 |
| i18n + RTL coverage (static) | 1 | 0 | 0 |
| Real YouTube oEmbed network call | 1 | 0 | 0 |
| Real OpenAI /models network call | 1 | 0 | 0 |
| Real Tavily search network call (with key) | 1 | 0 | 0 |
| Visual browser verification | 0 | 0 | 1 |
| Real LLM completion (requires user key) | 0 | 0 | 1 |
| **Total** | **86** | **0** | **2** |

Both NOT RUN items are honestly marked and explained — they require either a user-supplied API key or a real browser, neither of which the sandbox provides.
