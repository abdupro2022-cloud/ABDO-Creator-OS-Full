# MASTER_REQUIREMENTS — ABDO Creator OS

This is the canonical, complete requirement set for the ABDO Creator OS project.
Sections 1–11 come from the original brief. Sections 12–25 come from the continuation brief.
Nothing in either set has been discarded or simplified.

Status legend: **NOT STARTED** · **IN PROGRESS** · **IMPLEMENTED** · **VERIFIED** · **BLOCKED**.

The full requirements checklist with per-requirement status lives in `REQUIREMENTS_CHECKLIST.md`.

---

## 1. CORE MISSION AND NON-NEGOTIABLE RULES
- Build a real, production-oriented, full-stack application — not a static dashboard, prototype, or generic chatbot.
- Inspect the actual workspace before making changes.
- Work on the current project; never restore or copy from a previous project version.
- Never replace working functionality with simplified placeholders.
- Never claim an integration, feature, test, or deployment works unless verified.
- Never present mock responses as real AI results.
- Never leave critical buttons, forms, workflows, or settings nonfunctional.
- Do not silently omit requirements because implementation is difficult.
- Do not waste credits on plans, re-reads, or rewrites of already-working components.
- Use the actual project framework, backend, and deployment constraints.
- Make sensible engineering decisions independently.
- Stop and ask only when a decision could fundamentally change architecture, security, or remove a requirement.
- Never hide a limitation.

## 2. CONTEXT PRESERVATION AND PHASE MANAGEMENT
- Maintain persistent project records: `PROJECT_STATE.md`, `REQUIREMENTS_CHECKLIST.md`, `IMPLEMENTATION_PLAN.md`, `ARCHITECTURE_DECISIONS.md`, `TEST_RESULTS.md`.
- These files must record completed work, remaining work, known bugs, tests executed, current phase, and constraints not to forget.
- Before each new phase or resume, read project state and continue from actual current state.
- After each significant change, update the project record.
- At each phase boundary, save a concise handoff summary.

## 3. IMPLEMENTATION STRATEGY
- Controlled, verifiable phases: Foundation/Vertical Slice → AI Orchestration → Creator Tools → Configuration/Extensibility → Verification/Delivery.
- Do not attempt the entire system in one unverified code-generation operation.
- First vertical slice must work end to end before expansion.
- After each phase report: what was implemented, what changed, what passed/failed, what remains, what is next.

## 4. APPLICATION ARCHITECTURE
- Modular, maintainable, real-stack application.
- Preferred frontend: React + TypeScript, reusable components, responsive layouts, accessible controls, real loading/success/empty/error states.
- Preferred backend: Supabase (PostgreSQL, Auth, Storage, RLS, Edge Functions) where supported; otherwise the most suitable genuine backend available.
- Do not force Supabase into an unsupported environment.
- Clear module boundaries for: auth, user/project management, AI provider registry, model discovery, credential management, agent orchestration, workflow execution, research, content creation, skills, memory, community, notifications, settings/admin.
- Typed interfaces, schema validation, reusable services, clear module boundaries, appropriate error handling.
- Architecture must allow new providers, agents, skills, and tools to be added without rewriting the application.

## 5. AUTHENTICATION, USERS, AND DATA SECURITY
- Genuine authentication using the supported backend.
- Sign-up, sign-in, session persistence, sign-out, password recovery where supported.
- Protected app areas, user-specific data, project ownership, role-based permissions where needed.
- Users must not access other users' private projects, conversations, credentials, or artifacts.
- Server-side authorization and database-level access controls where available.
- API keys, tokens, and secrets must never appear in client-side code, public DB records, browser-visible server secrets, or logs.
- Credentials stored with server-side encryption or the strongest supported mechanism.
- Never claim encryption that the implementation does not provide.

## 6. FLEXIBLE AI PROVIDERS AND MODEL SELECTION
- Dedicated Provider & Model Integrations page.
- Distinguish: built-in connectors, available catalog, global (admin) integrations, personal integrations, custom user providers.
- Personal configurations must not bleed into other users.
- Users can: browse providers, search/filter catalog, select provider, add own API key, replace/remove key, configure custom OpenAI-compatible endpoint, enter custom model ID, discover models when supported, select a preferred model, choose different models for different tasks, test connection, view real connection errors, enable/disable integration, set defaults, configure task-specific preferences, configure fallbacks, view provider capabilities, see connection state (configured / connected / failing / unavailable).
- Extensible catalog. Do not falsely label unimplemented providers as functional.
- Provider-specific adapters behind a common interface.
- Capability metadata when reliable: text gen, structured outputs, tool calling, image input/output, audio, video understanding, embeddings, context limits, streaming, reasoning.
- Only advertise capabilities actually supported or reliably documented; label the rest as unknown.
- Do not force a single provider/model on all tasks.

## 7. API KEY MANAGEMENT AND COST CONTROL
- Personal API keys as a first-class feature.
- Clearly explain which credential will be used for a request.
- Use the selected user's key when personal credentials are configured and selected.
- Do not silently substitute another user's key.
- Allow preference for personal vs administrator-provided credentials.
- If a provider/key fails, report the failure clearly.
- Fallback only when configured or permitted by user preferences.
- Never silently send private content to a different provider without authorization.
- Cost-control features where possible: usage tracking, request/token estimates, actual usage when returned, configurable task limits, timeouts, retry limits, rate-limit handling, cancellation, duplicate-request prevention, configurable fallback, clear reporting of unavailable quota.
- Never fabricate token counts, prices, or usage data.
- Distinguish estimates from actual provider-reported usage.

## 8. FIVE COLLABORATIVE AI ROLES
- Advocate — develops the user's idea, opportunities, improvements.
- Critic — challenges assumptions, identifies weaknesses, risks, missing info, unsupported claims.
- Synthesizer — reconciles Advocate vs Critic, produces the strongest balanced recommendation.
- Business Analyst — examines audience, feasibility, resources, impact, objectives.
- Final Client / Quality Reviewer — evaluates combined result against original request, format, reliability, completeness, quality.
- Roles have explicit responsibilities; they must not just produce five unrelated answers.
- Workflow defines: task, inputs, agent responsibilities, order, dependencies, output format, completion criteria, error/recovery behavior.
- Not every task needs all five agents; task classification selects the workflow; users may customize when appropriate.

## 9. AGENT HANDOFFS, TRACEABILITY, FINAL RESULTS
- Outputs must actually be passed between agents when workflow requires collaboration.
- Example flow: Advocate → Critic (reviews Advocate) → Synthesizer (combines) → Business Analyst → Final Reviewer (evaluates final).
- Workflow supports dependencies, structured intermediate results, error handling, appropriate re-execution.
- Inspectable workflow view: which agents, order, inputs/outputs, disagreements, final derivation, errors/skips, final deliverable.
- Respect privacy and credential security. Do not expose hidden internal chain-of-thought; provide useful summaries, decisions, evidence.
- **Final result quality is primary.** Intermediate outputs are useful for transparency but must not overwhelm the main experience.
- Final Reviewer evaluates against explicit quality criteria.
- System may request targeted revision within configured limits.
- Enforce max iterations, timeouts, cancellation. No endless loops.

## 10. STRUCTURED AGENT CONTRACTS
- Explicit, validated output contracts (JSON Schema / Zod).
- Fields as appropriate: status, summary, findings, recommendations, evidence refs, assumptions, risks, confidence/uncertainty, unresolved questions, next actions, final deliverable.
- Different schemas for different task types.
- Do not depend on fragile free-form text parsing.
- If an agent produces invalid output: bounded repair, record failure, retry when appropriate, stop safely, explain failure.

## 11. WORKFLOW EXECUTION AND RECOVERY
- Real task execution: create, status, progress, current step, intermediate artifacts, cancellation, retry, resume, error reporting, completion summaries.
- Persist checkpoints for long-running tasks: task id, workflow version, current step, completed steps, persisted outputs, required input refs, execution settings, error/retry state, remaining steps.
- On resume, do not blindly rerun completed agents; reuse valid persisted results.
- Prevent duplicate submissions and side effects.
- Handle timeouts, rate limits, quota exhaustion, network failure, invalid credentials by failure type.
- Provide cancellation/retry controls in the interface.
- If reliable background execution is unsupported, document the limitation honestly.

## 12. RESEARCH, SOURCES, AND FACT-CHECKING
- Genuine research + evidence-management system.
- Real web-search and content-extraction providers via modular adapters when environment + credentials support it.
- Research providers kept separate from AI LM providers.
- Support: queries, search results, source URLs, page titles, publication dates, retrieval timestamps, extracted evidence, source reliability notes, claim-to-source associations, conflicting evidence, missing evidence, fact-checking reports, summaries, saved collections.
- Link important factual claims to supporting evidence.
- Distinguish: verified facts, claims supported by evidence, unverified claims, conflicting evidence, inferences, speculation.
- Never invent citations, URLs, source contents, quotes, publication dates, or research results.
- If a source cannot be accessed, explain that limitation.
- Distinguish provider failure from successful empty result.
- Fact-checking must actively identify unsupported claims and contradictions.
- Store source references alongside research artifacts.
- Clear research UI: final report + expand individual claims to see evidence.

## 13. CONTENT CREATION AND CREATOR TOOLS
- Functional collection: idea dev, content research, audience analysis, planning, topic discovery, script writing, article writing, social posts, rewriting/editing, summarization, repurposing, quality review, SEO analysis, competitor analysis when real data, content-gap analysis, content extraction, fact-checking, YouTube research, transcript analysis, content production planning.
- Not every tool = the same generic prompt.
- Each tool: purpose, inputs, agent selection, workflow, outputs, error handling, save.
- **Script Studio**: create, edit, organize into projects, drafts, compare revisions when supported, structure/pacing review, hook/intro review, audience engagement, factual claims, titles/descriptions, repurposing, export/copy. Uses real app data and configured AI providers.
- **YouTube tools** (where supported): video info, channel info, transcript retrieval, transcript analysis, topic extraction, key-point summaries, content structure, competitor comparisons, content improvement suggestions.
- Use legitimate, available APIs and retrieval; respect permissions, rate limits, content-access restrictions, provider terms.
- Never fabricate transcripts, channel metrics, video stats, or competitor performance.
- If transcript cannot be retrieved, explain and offer alternatives (e.g., user pastes transcript).
- **SEO & competitor**: use real source data; distinguish measured vs estimates vs recommendations; never invent search volumes, traffic, keyword difficulty, rankings, or competitor analytics. If metrics unavailable, qualitative analysis with clear limitations.

## 14. PROJECTS, CONVERSATIONS, LONG-TERM MEMORY
- Persistent project management + context-aware workflows.
- Users can: create, rename, open, continue projects, organize conversations, view task history, access artifacts, resume incomplete tasks, delete own data, search saved projects/content.
- Distinct context scopes: user preferences, project-specific context, task-specific context, conversation history, reusable knowledge/artifacts.
- Do not mix unrelated projects; never expose one user's data to another.
- Use relevant context retrieval, not blind full-history sends.
- Use summaries, artifact refs, bounded context windows.
- Users can inspect, correct, delete stored preferences/memories.
- Distinguish persistent memory from temporary task context.
- **Memory safety**: don't treat every statement as permanent memory. Separate explicit preferences from temporary instructions and unverified assumptions. Preserve source/context of saved info. When stored info conflicts with newer explicit instruction, follow newer for current task, update persistent preferences when appropriate. Never allow one user's memories into another's context. Never fabricate past conversations, decisions, or progress. On resume, inspect actual saved state, don't assume.

## 15. SKILLS SYSTEM — SECURE AND EXTENSIBLE
- First-class Skills: reusable, versioned capabilities with instructions, inputs, expected outputs, permitted tools, execution rules.
- Users can: browse, search/filter, view descriptions, enable/disable, create personal, edit own, version, duplicate, import, export, organize into categories, select for task/project, view compatibility, view execution status/errors, review permissions.
- Built-in and user-created Skills.
- Extensible — adding a Skill must not require rewriting the app.
- Each Skill defines: name, description, version, author/owner, required inputs, output format, required provider capabilities, permitted tools, permissions, dependencies, execution limits, validation rules, compatibility info.
- **Security**: imported/user-created Skills are untrusted input. Do not execute arbitrary code from a Skill. Do not allow Skills to bypass auth, access other users' data, expose secrets, modify protected settings without permission, or call tools outside their permitted scope. Validate imports. Permission boundaries + allowlist. Distinguish declarative instructions from executable code. If executable extensions are supported, sandbox + least privilege. Show users which tools/data/actions a Skill can access. Reject unsafe/invalid definitions with understandable errors. Version Skills so changes can be tracked and bad versions disabled. Do not claim Skill success when required tool/provider is unavailable.

## 16. UI, NAVIGATION, USER EXPERIENCE
- Coherent professional app with functional navigation.
- Required areas: Home/Workspace, AI Assistant, Projects, Conversations/task history, Agent workflow/trace, Research, Content creation tools, Script Studio, Skills Library, Provider & Model Integrations, Community (where supported), Help/docs, Settings, Admin (for authorized users).
- Reusable components, consistent interaction patterns.
- **i18n**: Arabic + English, Arabic uses proper RTL, English uses LTR, directionality correctly applied to nav, forms, tables, dialogs, inputs.
- Responsive: mobile, tablet, desktop.
- Apply design system + a11y guidance, but visual refinement must not replace functional implementation.
- States: loading, empty, validation messages, success feedback, error messages, confirm for destructive actions, progress for long tasks, clear disabled states.
- Every visible interactive control performs its stated action or clearly communicates unavailability.
- No decorative elements imitating missing functionality.
- Final deliverable + status prominent; detailed agent execution in separate expandable view.

## 17. COMMUNITY, HELP, ADMINISTRATION
- Community (where supported): publish permitted content/Skills, browse shared, search, view details, report, manage submissions, moderation states, authorized admin actions.
- States: Draft, Pending review, Published, Rejected, Removed.
- Ownership, visibility, permissions enforced.
- Never expose private projects/conversations/credentials/personal data through community.
- Contextual help and docs.
- AI help assistant (if implemented) must be distinguished from static docs and must not access unauthorized user info.
- Admin capabilities protected by server-side authorization.
- Don't claim community moderation/admin is operational unless implemented and tested.

## 18. DATABASE AND DATA INTEGRITY
- Consistent data model. Entities include: users/profiles, projects, conversations/messages, tasks/workflow runs, agent execution records, intermediate outputs, final artifacts, research sources/evidence, provider configs, model preferences, credential references, Skills + versions, user preferences/memories, community content, reports/moderation, usage records.
- Relationships, constraints, indexes, timestamps, ownership, validation rules.
- Migrations / reproducible schema management.
- Transactions where necessary.
- Avoid storing sensitive credentials in plain app tables unless the storage mechanism is appropriately protected.
- If credentials stored as references, references must only be usable through authorized server-side ops.
- RLS or equivalent backend authorization where available.
- Updates/deletes must not silently corrupt dependent data.
- Define retention/deletion behavior for user-owned info.
- Repeatable migrations, document how to apply.
- Document backend-specific limitations honestly.

## 19. TESTING AND ACCEPTANCE CRITERIA
- Test actual behavior, not just compile success.
- Unit, integration, and e2e tests as supported.
- At minimum verify (28 acceptance items — see REQUIREMENTS_CHECKLIST.md).
- Do not report tests as passed unless actually executed.
- Mark NOT RUN and explain when environmental limitations prevent a test.
- Fix critical defects before expanding to optional features.
- At phase boundaries, test new functionality + relevant existing functionality.

## 20. PERFORMANCE, RELIABILITY, MAINTAINABILITY
- Reasonable timeouts, bounded retries, pagination, input validation, resource limits.
- Avoid unnecessary DB queries and repeated AI calls.
- Prevent infinite workflow loops and uncontrolled parallel requests.
- Handle rate limits and transient failures.
- Structured logging that excludes API keys, passwords, private tokens, and sensitive content unless explicitly necessary and safely handled.
- Modules understandable and independently testable.
- Avoid unnecessary infrastructure, dependencies, complexity.
- Prefer simple maintainable implementations over elaborate unverified systems.
- Preserve existing working functionality when modifying.
- After change, inspect effects on dependent modules and run relevant tests.

## 21. DEPLOYMENT AND DOCUMENTATION
- Useful README: what the app does, architecture, env vars, backend config, AI provider config, how personal API keys are stored/used, how to run, test, build, deploy, known limitations, how to add provider / Skill / extend workflow, troubleshoot.
- Env-var example file with no real credentials.
- No real secrets in docs or source.
- Migrations, setup, deployment config as supported.
- If a service requires manual setup/credentials I must provide, explain exactly what is required and where.
- Don't claim deployment is complete just because instructions exist.
- Verify deployment status with available tools if possible; otherwise document remaining manual steps.

## 22. CREDIT EFFICIENCY AND IMPLEMENTATION DISCIPLINE
- Use full reasoning while conserving credits.
- Don't equate more tokens with better software.
- Inspect workspace and reuse findings; maintain checklist; make targeted changes; reuse working components; avoid regenerating large files when a patch suffices; avoid repeating analysis; focused tests after targeted changes; broader validation at phase boundaries; don't reinstall deps unnecessarily; avoid unnecessary external calls + redundant agent runs; prefer deterministic local validation; don't invoke every agent when one or two suffice; limit retries + revision loops; record discoveries; prioritize high-risk / foundational / user-visible first; don't polish minor details while critical functionality is broken.
- Don't generate the entire app in one enormous unverified operation.
- Don't unnecessarily repeat large spec sections; reference the master file + project state.
- If credits/context threaten continuity, save state and provide a precise handoff summary.
- Don't silently truncate requirements to save credits.

## 23. HANDLING AMBIGUITY AND BLOCKERS
- Don't guess when misunderstanding could damage the project.
- Identify the exact ambiguity; explain consequences; recommend best option; ask a concise specific question; wait for direction when truly required.
- Don't ask things answerable by inspecting the project, environment, or ordinary engineering decisions.
- Don't stop the entire project because an optional integration is unavailable.
- Continue with independent unblocked tasks while documenting blocked dependencies.
- Never silently replace a required feature with a mock.
- If the environment makes a requirement impossible, explain the limitation and present the closest honest alternative.
- If a requirement depends on an unavailable external service, preserve the integration architecture and document what is needed to activate it.
- Don't mark blocked features as implemented or verified.

## 24. FINAL DEFINITION OF DONE
- Before declaring completion, verify the full list in the "Definition of Done" appendix below.
- Final report: what was completed, architectural decisions, files changed, tests executed + results, remaining features, environmental/integration limits, required manual config, exact next steps.
- Don't claim perfect completion if required functionality remains unverified.

## 25. EXECUTION AND CONTINUITY PROTOCOL
- Continue from the actual current project/workspace; never restore from an earlier version; don't restart completed work without a technical reason.
- **FIRST**: inspect workspace + environment; confirm which spec parts are available; add Sections 12–25 to `MASTER_REQUIREMENTS.md` (this file); reconcile with 1–11; update plan and phase mapping; identify missing info and blockers.
- **THEN**: begin/continue Phase 1; implement a small but genuinely functional end-to-end vertical slice; verify; record test outcomes; update state; proceed.
- At end of each phase, save a complete handoff record.
- If a requirement is missing from context, say so and ask; never pretend missing text was recovered.
- If a decision genuinely requires user direction, ask before risking a wrong assumption.
- Ultimate goal: real, secure, extensible, maintainable ABDO Creator OS preserving all requirements, producing high-quality deliverables, efficient use of free credits.

---

## APPENDIX — Definition of Done (from §24)

- [ ] Architecture documented.
- [ ] Master requirements checklist updated.
- [ ] Core workflows function end to end.
- [ ] Auth + data boundaries tested where implemented.
- [ ] AI provider config works as implemented.
- [ ] Users can add/manage personal API keys securely.
- [ ] Provider catalog distinguishes implemented vs unavailable.
- [ ] Provider + model selection works within actual provider capabilities.
- [ ] Agent handoffs use real intermediate outputs.
- [ ] Users can inspect workflow activity without losing focus on the final deliverable.
- [ ] Long-running tasks recoverable to the extent the environment supports.
- [ ] Skills extensible and appropriately restricted.
- [ ] Research evidence and citations handled honestly.
- [ ] Critical controls work.
- [ ] Important tests executed + results recorded.
- [ ] Known limitations documented.
- [ ] Deployment instructions available.
- [ ] No critical feature falsely represented as functional.
