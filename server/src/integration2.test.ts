import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

let tmp: string;
beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "abdo-int2-"));
  process.env.DATABASE_FILE = join(tmp, "test.sqlite");
  process.env.APP_KEK = randomBytes(32).toString("hex");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  // Mock undici to prevent real network calls
  vi.mock("undici", () => ({ request: vi.fn() }));
  const { applyMigrations } = await import("./db.js");
  applyMigrations();
});
afterAll(() => {
  if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});

function makeReq() {
  return async function req(
    app: Express,
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
    url: string,
    opts: { token?: string; body?: unknown } = {},
  ) {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(JSON.stringify(opts.body)));
    }
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const r = httpRequest(
        { hostname: "127.0.0.1", port, path: url, method, headers },
        (response: IncomingMessage) => {
          const chunks: Buffer[] = [];
          response.on("data", (c: Buffer) => chunks.push(c));
          response.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            let body: any = raw;
            try { body = JSON.parse(raw); } catch { /* leave as raw */ }
            resolve({ status: response.statusCode ?? 0, body });
          });
        },
      );
      r.on("error", reject);
      if (opts.body !== undefined) r.write(JSON.stringify(opts.body));
      r.end();
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return result;
  };
}
const req = makeReq();

async function makeApp() {
  const { authRouter } = await import("./routes/auth.js");
  const { recoveryRouter } = await import("./routes/recovery.js");
  const { communityRouter } = await import("./routes/community.js");
  const { scriptsRouter } = await import("./routes/scripts.js");
  const { conversationsRouter } = await import("./routes/conversations.js");
  const { workflowsRouter } = await import("./routes/workflows.js");
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api/auth", recoveryRouter);
  app.use("/api/community", communityRouter);
  app.use("/api/scripts", scriptsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/workflows", workflowsRouter);
  return app;
}

describe("Phase 2-4 integration", () => {
  it("password recovery request + reset round-trip", async () => {
    const app = await makeApp();
    const signup = await req(app, "POST", "/api/auth/signup", { body: { email: "r@example.com", password: "password1234" } });
    expect(signup.status).toBe(201);
    const req1 = await req(app, "POST", "/api/auth/recovery/request", { body: { email: "r@example.com" } });
    expect(req1.status).toBe(200);
    const token = req1.body.devToken as string;
    expect(token).toBeTruthy();
    const reset = await req(app, "POST", "/api/auth/recovery/reset", { body: { token, newPassword: "newpass1234" } });
    expect(reset.status).toBe(200);
    // Old password should fail
    const oldSignin = await req(app, "POST", "/api/auth/signin", { body: { email: "r@example.com", password: "password1234" } });
    expect(oldSignin.status).toBe(401);
    // New password should work
    const newSignin = await req(app, "POST", "/api/auth/signin", { body: { email: "r@example.com", password: "newpass1234" } });
    expect(newSignin.status).toBe(200);
  });

  it("recovery token is single-use and time-limited", async () => {
    const app = await makeApp();
    await req(app, "POST", "/api/auth/signup", { body: { email: "r2@example.com", password: "password1234" } });
    const req1 = await req(app, "POST", "/api/auth/recovery/request", { body: { email: "r2@example.com" } });
    const token = req1.body.devToken;
    const r1 = await req(app, "POST", "/api/auth/recovery/reset", { body: { token, newPassword: "abcdefgh" } });
    expect(r1.status).toBe(200);
    const r2 = await req(app, "POST", "/api/auth/recovery/reset", { body: { token, newPassword: "another1" } });
    expect(r2.status).toBe(400);
  });

  it("scripts CRUD with project binding and ownership", async () => {
    const { projectsRouter } = await import("./routes/projects.js");
    const { scriptsRouter } = await import("./routes/scripts.js");
    const express = (await import("express")).default;
    const a = express();
    a.use(express.json());
    a.use("/api/auth", (await import("./routes/auth.js")).authRouter);
    a.use("/api/projects", projectsRouter);
    a.use("/api/scripts", scriptsRouter);

    const s = await req(a, "POST", "/api/auth/signup", { body: { email: "a1@example.com", password: "password1234" } });
    const t1 = s.body.token as string;
    const p = await req(a, "POST", "/api/projects", { token: t1, body: { name: "P1" } });
    const pid = p.body.project.id;

    const sc = await req(a, "POST", "/api/scripts", { token: t1, body: { title: "Script 1", projectId: pid } });
    expect(sc.status).toBe(201);
    const sid = sc.body.script.id;

    const list = await req(a, "GET", "/api/scripts", { token: t1 });
    expect(list.status).toBe(200);
    expect(list.body.scripts.length).toBe(1);

    const upd = await req(a, "PATCH", `/api/scripts/${sid}`, { token: t1, body: { title: "Script 1 updated", hook: "New hook" } });
    expect(upd.status).toBe(200);
    expect(upd.body.script.hook).toBe("New hook");

    const revs = await req(a, "GET", `/api/scripts/${sid}/revisions`, { token: t1 });
    expect(revs.status).toBe(200);
    // revision was created because hook changed
    expect(revs.body.revisions.length).toBeGreaterThanOrEqual(1);

    // Cross-user: signup b
    const s2 = await req(a, "POST", "/api/auth/signup", { body: { email: "b1@example.com", password: "password1234" } });
    const t2 = s2.body.token as string;
    const crossRead = await req(a, "GET", `/api/scripts/${sid}`, { token: t2 });
    expect(crossRead.status).toBe(404);
    const crossDel = await req(a, "DELETE", `/api/scripts/${sid}`, { token: t2 });
    expect(crossDel.status).toBe(404);
    const del = await req(a, "DELETE", `/api/scripts/${sid}`, { token: t1 });
    expect(del.status).toBe(200);
  });

  it("conversations scoped to projects and owners", async () => {
    const { projectsRouter } = await import("./routes/projects.js");
    const { conversationsRouter } = await import("./routes/conversations.js");
    const express = (await import("express")).default;
    const a = express();
    a.use(express.json());
    a.use("/api/auth", (await import("./routes/auth.js")).authRouter);
    a.use("/api/projects", projectsRouter);
    a.use("/api/conversations", conversationsRouter);

    const s = await req(a, "POST", "/api/auth/signup", { body: { email: "c1@example.com", password: "password1234" } });
    const t1 = s.body.token as string;
    const p = await req(a, "POST", "/api/projects", { token: t1, body: { name: "P" } });
    const pid = p.body.project.id;

    const c1 = await req(a, "POST", "/api/conversations", { token: t1, body: { projectId: pid, title: "C1" } });
    expect(c1.status).toBe(201);
    const cid = c1.body.conversation.id;

    const m1 = await req(a, "POST", `/api/conversations/${cid}/messages`, { token: t1, body: { role: "user", content: "Hello" } });
    expect(m1.status).toBe(201);
    const m2 = await req(a, "POST", `/api/conversations/${cid}/messages`, { token: t1, body: { role: "assistant", content: "Hi" } });
    expect(m2.status).toBe(201);

    const list = await req(a, "GET", `/api/conversations/${cid}/messages`, { token: t1 });
    expect(list.status).toBe(200);
    expect(list.body.messages.length).toBe(2);

    // Cross-user isolation
    const s2 = await req(a, "POST", "/api/auth/signup", { body: { email: "c2@example.com", password: "password1234" } });
    const t2 = s2.body.token as string;
    const cross = await req(a, "GET", `/api/conversations/${cid}/messages`, { token: t2 });
    expect(cross.status).toBe(404);
  });

  it("community publish requires ownership; moderation requires admin", async () => {
    const { skillsRouter } = await import("./routes/skills.js");
    const { communityRouter } = await import("./routes/community.js");
    const express = (await import("express")).default;
    const a = express();
    a.use(express.json());
    a.use("/api/auth", (await import("./routes/auth.js")).authRouter);
    a.use("/api/skills", skillsRouter);
    a.use("/api/community", communityRouter);

    const s = await req(a, "POST", "/api/auth/signup", { body: { email: "p1@example.com", password: "password1234" } });
    const t = s.body.token as string;

    // Create a skill
    const sk = await req(a, "POST", "/api/skills", { token: t, body: {
      name: "My Skill", version: "1.0.0", category: "x", description: "x",
      systemPrompt: "you help", inputSchema: { type: "object" }, outputSchema: { type: "object" },
      requiredCapabilities: ["text"], permissions: ["read:own_projects"], allowedTools: ["providers.chat"], executable: false,
    } });
    expect(sk.status).toBe(201);
    const skillId = sk.body.skill.id;

    // Publish it
    const pub = await req(a, "POST", "/api/community/publishes", { token: t, body: { skillId, title: "T", description: "d" } });
    expect(pub.status).toBe(201);
    expect(pub.body.publish.state).toBe("pending_review");

    // Non-admin cannot moderate
    const mod = await req(a, "POST", `/api/community/publishes/${pub.body.publish.id}/moderate`, { token: t, body: { state: "published" } });
    expect(mod.status).toBe(403);

    // Cannot publish a skill you don't own
    const s2 = await req(a, "POST", "/api/auth/signup", { body: { email: "p2@example.com", password: "password1234" } });
    const t2 = s2.body.token as string;
    const bad = await req(a, "POST", "/api/community/publishes", { token: t2, body: { skillId, title: "X", description: "d" } });
    expect(bad.status).toBe(404);
  });

  it("workflow endpoint requires configured provider and returns 409 if missing", async () => {
    const { workflowsRouter } = await import("./routes/workflows.js");
    const express = (await import("express")).default;
    const a = express();
    a.use(express.json());
    a.use("/api/auth", (await import("./routes/auth.js")).authRouter);
    a.use("/api/workflows", workflowsRouter);

    const s = await req(a, "POST", "/api/auth/signup", { body: { email: "w1@example.com", password: "password1234" } });
    const t = s.body.token as string;
    const r = await req(a, "POST", "/api/workflows", { token: t, body: { prompt: "test", taskClass: "simple" } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("no_provider_configured");
  });

  it("help docs list and per-doc endpoint", async () => {
    const { helpRouter } = await import("./routes/help.js");
    const express = (await import("express")).default;
    const a = express();
    a.use(express.json());
    a.use("/api/auth", (await import("./routes/auth.js")).authRouter);
    a.use("/api/help", helpRouter);

    const s = await req(a, "POST", "/api/auth/signup", { body: { email: "h1@example.com", password: "password1234" } });
    const t = s.body.token as string;
    const list = await req(a, "GET", "/api/help/docs", { token: t });
    expect(list.status).toBe(200);
    expect(list.body.docs.length).toBeGreaterThan(0);
    const one = await req(a, "GET", "/api/help/docs/providers", { token: t });
    expect(one.status).toBe(200);
    expect(one.body.doc.id).toBe("providers");
    const missing = await req(a, "GET", "/api/help/docs/does-not-exist", { token: t });
    expect(missing.status).toBe(404);
  });
});
