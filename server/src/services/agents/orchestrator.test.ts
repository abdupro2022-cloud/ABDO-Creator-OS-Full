import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;
beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "abdo-orch-"));
  process.env.DATABASE_FILE = join(tmpDir, "test.sqlite");
  process.env.APP_KEK = randomBytes(32).toString("hex");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  const { applyMigrations } = await import("../../db.js");
  applyMigrations();
});

// Mock undici BEFORE importing the orchestrator
vi.mock("undici", () => ({ request: vi.fn() }));

import { request as undiciRequest } from "undici";
const mockedRequest = vi.mocked(undiciRequest);

import { runWorkflow, FULL_CHAIN, SIMPLE_CHAIN } from "./orchestrator.js";
import { db } from "../../db.js";

function okResponse(body: unknown) {
  return {
    statusCode: 200,
    body: { text: async () => JSON.stringify(body) },
  } as unknown as Awaited<ReturnType<typeof undiciRequest>>;
}

function errorResponse(status: number, body: string) {
  return {
    statusCode: status,
    body: { text: async () => body },
  } as unknown as Awaited<ReturnType<typeof undiciRequest>>;
}

function structuredPayload(role: string) {
  return {
    choices: [{ message: { content: JSON.stringify({
      status: "ok",
      summary: `${role} summary`,
      key_points: [`${role} kp1`, `${role} kp2`],
      recommendations: [`${role} r1`],
      assumptions: [],
      risks: [],
      confidence: 0.8,
      next_actions: [`next for ${role}`],
    }) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

beforeEach(async () => {
  // Reset DB tables
  db.exec(`DELETE FROM workflow_steps; DELETE FROM workflow_runs; DELETE FROM usage_records; DELETE FROM user_provider_configs; DELETE FROM users;`);
  // Insert a test user
  const { nanoid } = require("nanoid") as { nanoid: () => string };
  const userId = nanoid();
  db.prepare(`INSERT INTO users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'user', ?, ?)`).run(
    userId, `o-${userId}@example.com`, null, "x", new Date().toISOString(), new Date().toISOString(),
  );
  // Insert a test provider config
  const { encryptSecret } = await import("../../crypto/envelope.js");
  const enc = encryptSecret("sk-test-key");
  const configId = nanoid();
  db.prepare(
    `INSERT INTO user_provider_configs (id, user_id, catalog_id, label, base_url, encrypted_api_key, default_model, enabled, created_at, updated_at)
     VALUES (?, ?, 'openai', 'test', 'https://api.openai.com/v1', ?, 'gpt-4o-mini', 1, ?, ?)`,
  ).run(configId, userId, enc, new Date().toISOString(), new Date().toISOString());
  (global as unknown as { __testUserId: string; __testConfigId: string }).__testUserId = userId;
  (global as unknown as { __testUserId: string; __testConfigId: string }).__testConfigId = configId;
});

describe("orchestrator", () => {
  it("runs the full 5-role chain and persists each step", async () => {
    mockedRequest.mockImplementation(async () => okResponse(structuredPayload("advocate")));
    const userId = (global as unknown as { __testUserId: string }).__testUserId;
    const configId = (global as unknown as { __testConfigId: string }).__testConfigId;
    const { resolveProviderForUser } = await import("../../routes/providers.js");
    const provider = resolveProviderForUser(userId, configId, "gpt-4o-mini");
    expect(provider).not.toBeNull();
    const { nanoid } = require("nanoid") as { nanoid: () => string };
    const runId = nanoid();
    db.prepare(
      `INSERT INTO workflow_runs (id, owner_id, task_class, user_prompt, provider_config_id, model, status, created_at, updated_at)
       VALUES (?, ?, 'full', 'p', ?, 'gpt-4o-mini', 'pending', ?, ?)`,
    ).run(runId, userId, configId, new Date().toISOString(), new Date().toISOString());

    const result = await runWorkflow({
      runId, userId, userPrompt: "p",
      provider: provider!,
      chain: FULL_CHAIN,
    });
    expect(result.steps.length).toBe(5);
    expect(result.steps.every((s) => s.status === "completed")).toBe(true);
    expect(result.finalOutput).not.toBeNull();
    // Each step produced one provider call
    expect(mockedRequest).toHaveBeenCalledTimes(5);
    // DB updated
    const run = db.prepare(`SELECT status, final_output_json FROM workflow_runs WHERE id = ?`).get(runId) as { status: string; final_output_json: string };
    expect(run.status).toBe("completed");
    expect(run.final_output_json).toBeTruthy();
  });

  it("stops the chain on provider failure and records the error", async () => {
    mockedRequest.mockImplementation(async () => errorResponse(401, '{"error":"bad key"}'));
    const userId = (global as unknown as { __testUserId: string }).__testUserId;
    const configId = (global as unknown as { __testConfigId: string }).__testConfigId;
    const { resolveProviderForUser } = await import("../../routes/providers.js");
    const provider = resolveProviderForUser(userId, configId, "gpt-4o-mini");
    const { nanoid } = require("nanoid") as { nanoid: () => string };
    const runId = nanoid();
    db.prepare(
      `INSERT INTO workflow_runs (id, owner_id, task_class, user_prompt, provider_config_id, model, status, created_at, updated_at)
       VALUES (?, ?, 'simple', 'p', ?, 'gpt-4o-mini', 'pending', ?, ?)`,
    ).run(runId, userId, configId, new Date().toISOString(), new Date().toISOString());

    const result = await runWorkflow({
      runId, userId, userPrompt: "p",
      provider: provider!,
      chain: SIMPLE_CHAIN,
    });
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].status).toBe("failed");
    expect(result.finalOutput?.status).toBe("error");
    const run = db.prepare(`SELECT status, error FROM workflow_runs WHERE id = ?`).get(runId) as { status: string; error: string };
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/401/);
  });
});
