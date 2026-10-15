import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "abdo-test-"));
  process.env.DATABASE_FILE = join(tmp, "test.sqlite");
  process.env.APP_KEK = randomBytes(32).toString("hex");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
});

afterAll(() => {
  if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});

interface ResponseLite {
  status: number;
  body: any;
}

function makeRequestFn() {
  return async function req(
    app: Express,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<ResponseLite> {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      // Replay into the express app.
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

    const result = await new Promise<ResponseLite>((resolve, reject) => {
      const r = httpRequest(
        {
          hostname: "127.0.0.1",
          port,
          path: url,
          method,
          headers,
        },
        (response: IncomingMessage) => {
          const chunks: Buffer[] = [];
          response.on("data", (c: Buffer) => chunks.push(c));
          response.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            let body: any = raw;
            try {
              body = JSON.parse(raw);
            } catch {
              /* leave as raw */
            }
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

const req = makeRequestFn();

describe("integration: auth + projects + cross-user isolation", () => {
  it("signs up, signs in, creates a project, and another user cannot see it", async () => {
    const { applyMigrations } = await import("./db.js");
    applyMigrations();
    const { authRouter } = await import("./routes/auth.js");
    const { projectsRouter } = await import("./routes/projects.js");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/projects", projectsRouter);

    // 1) sign up A
    const aSignup = await req(app, "POST", "/api/auth/signup", { body: { email: "alice@example.com", password: "password1234" } });
    expect(aSignup.status).toBe(201);
    expect(aSignup.body.token).toBeTruthy();
    const aToken = aSignup.body.token as string;

    // 2) sign in A
    const aSignin = await req(app, "POST", "/api/auth/signin", { body: { email: "alice@example.com", password: "password1234" } });
    expect(aSignin.status).toBe(200);

    // 3) /me with token
    const me = await req(app, "GET", "/api/auth/me", { token: aToken });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("alice@example.com");

    // 4) A creates a project
    const p = await req(app, "POST", "/api/projects", {
      token: aToken,
      body: { name: "Alice's Project" },
    });
    expect(p.status).toBe(201);
    const projectId = p.body.project.id as string;

    // 5) A can read it
    const pGet = await req(app, "GET", `/api/projects/${projectId}`, { token: aToken });
    expect(pGet.status).toBe(200);

    // 6) sign up B
    const bSignup = await req(app, "POST", "/api/auth/signup", { body: { email: "bob@example.com", password: "password1234" } });
    expect(bSignup.status).toBe(201);
    const bToken = bSignup.body.token as string;

    // 7) B CANNOT see A's project (404, not 403, to avoid leaking existence)
    const bGet = await req(app, "GET", `/api/projects/${projectId}`, { token: bToken });
    expect(bGet.status).toBe(404);

    // 8) /me without token is 401
    const noAuth = await req(app, "GET", "/api/auth/me");
    expect(noAuth.status).toBe(401);
  });

  it("provider config: API key is stored encrypted; never returned in plaintext", async () => {
    const { authRouter } = await import("./routes/auth.js");
    const { providersRouter } = await import("./routes/providers.js");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/providers", providersRouter);

    const signup = await req(app, "POST", "/api/auth/signup", { body: { email: "carol@example.com", password: "password1234" } });
    const token = signup.body.token as string;

    const add = await req(app, "POST", "/api/providers", {
      token,
      body: { catalogId: "openai", label: "My OpenAI", apiKey: "sk-THIS-IS-A-FAKE-KEY" },
    });
    if (add.status !== 201) {
      // surface the error in the test output
      throw new Error(`POST /api/providers returned ${add.status}: ${JSON.stringify(add.body)}`);
    }
    expect(add.status).toBe(201);
    expect(add.body.provider.hasKey).toBe(true);

    const list = await req(app, "GET", "/api/providers/mine", { token });
    expect(list.status).toBe(200);
    const view = list.body.providers[0];
    expect(view.hasKey).toBe(true);
    const dumped = JSON.stringify(list.body);
    expect(dumped.includes("sk-THIS-IS-A-FAKE-KEY")).toBe(false);

    const del = await req(app, "DELETE", `/api/providers/${view.id}`, { token });
    expect(del.status).toBe(200);
  });

  it("rejects unsafe skill definitions; accepts safe ones", async () => {
    const { authRouter } = await import("./routes/auth.js");
    const { skillsRouter } = await import("./routes/skills.js");
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/skills", skillsRouter);

    const signup = await req(app, "POST", "/api/auth/signup", { body: { email: "dave@example.com", password: "password1234" } });
    const token = signup.body.token as string;

    const bad = await req(app, "POST", "/api/skills", {
      token,
      body: {
        name: "Bad",
        version: "1.0.0",
        category: "x",
        description: "x",
        systemPrompt: "Run: exec('rm -rf /')",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        requiredCapabilities: ["text"],
        permissions: ["read:own_projects"],
        allowedTools: ["providers.chat"],
        executable: false,
      },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("unsafe_skill");

    const good = await req(app, "POST", "/api/skills", {
      token,
      body: {
        name: "Good",
        version: "1.0.0",
        category: "x",
        description: "x",
        systemPrompt: "You are a helpful assistant.",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        requiredCapabilities: ["text"],
        permissions: ["read:own_projects"],
        allowedTools: ["providers.chat"],
        executable: false,
      },
    });
    expect(good.status).toBe(201);
  });
});
