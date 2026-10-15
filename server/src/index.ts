import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { applyMigrations } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { providersRouter } from "./routes/providers.js";
import { agentsRouter } from "./routes/agents.js";
import { skillsRouter } from "./routes/skills.js";
import { researchRouter } from "./routes/research.js";
import { preferencesRouter } from "./routes/preferences.js";
import { usageRouter } from "./routes/usage.js";
import { workflowsRouter } from "./routes/workflows.js";
import { conversationsRouter } from "./routes/conversations.js";
import { scriptsRouter } from "./routes/scripts.js";
import { toolsRouter } from "./routes/tools.js";
import { helpRouter } from "./routes/help.js";
import { communityRouter } from "./routes/community.js";
import { recoveryRouter } from "./routes/recovery.js";
import { youtubeRouter } from "./routes/youtube.js";
import { researchSearchRouter } from "./routes/researchSearch.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// server/src/index.ts -> server/ -> project root
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLIENT_DIST = resolve(PROJECT_ROOT, "client", "dist");

applyMigrations();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: config.env, t: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/auth", recoveryRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/providers", providersRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/research", researchRouter);
app.use("/api/research", researchSearchRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/scripts", scriptsRouter);
app.use("/api/community", communityRouter);
app.use("/api/help", helpRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/usage", usageRouter);

// Serve the built client (single-binary deploy).
// If `client/dist` is missing, this is a no-op; the deploy platform
// will run `npm run build` before `npm start`.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: anything that didn't match an /api/* route and isn't a file
  // gets `index.html` so client-side routing works.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(resolve(CLIENT_DIST, "index.html"));
  });
  logger.info("serving client from disk", { path: CLIENT_DIST });
}

// 404 for /api/*
app.use("/api", (req, res) => {
  res.status(404).json({ error: { code: "not_found", message: `No route for ${req.method} ${req.originalUrl}` } });
});

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("unhandled", { message });
  res.status(500).json({ error: { code: "internal", message } });
});

app.listen(config.port, () => {
  logger.info("server listening", { port: config.port, env: config.env, clientOrigin: config.clientOrigin });
});
