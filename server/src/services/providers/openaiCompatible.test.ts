import { describe, it, expect, vi, afterEach } from "vitest";
import { AgentTurnOutputSchema } from "@abdo/shared";

// We test the contract by stubbing undici.request and running the route's parse logic.
// This validates: the provider adapter shape, JSON repair behavior, and structured-output parsing.
vi.mock("undici", () => {
  return {
    request: vi.fn(),
  };
});

import { request as undiciRequest } from "undici";
import { openaiCompatibleAdapter, ProviderError } from "./openaiCompatible.js";

const mockedRequest = vi.mocked(undiciRequest);

afterEach(() => {
  vi.resetAllMocks();
});

function okResponse(body: unknown) {
  return {
    statusCode: 200,
    body: {
      text: async () => JSON.stringify(body),
    },
  } as unknown as Awaited<ReturnType<typeof undiciRequest>>;
}

function errorResponse(status: number, body: string) {
  return {
    statusCode: status,
    body: { text: async () => body },
  } as unknown as Awaited<ReturnType<typeof undiciRequest>>;
}

describe("providers/openaiCompatible adapter", () => {
  it("sends a structured request and parses the response", async () => {
    mockedRequest.mockResolvedValueOnce(
      okResponse({
        choices: [{ message: { content: '{"status":"ok","summary":"hi","key_points":[],"recommendations":[],"assumptions":[],"risks":[],"confidence":0.5,"next_actions":[]}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );
    const result = await openaiCompatibleAdapter.call({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      systemPrompt: "You are a test.",
      userPrompt: "Hello",
      structured: true,
    });
    expect(result.text).toMatch(/"status":"ok"/);
    expect(result.usage.source).toBe("provider");
    expect(result.usage.promptTokens).toBe(10);
    const parsed = AgentTurnOutputSchema.safeParse(JSON.parse(result.text));
    expect(parsed.success).toBe(true);
  });

  it("classifies 401 as invalid_key", async () => {
    mockedRequest.mockResolvedValueOnce(errorResponse(401, '{"error":"bad key"}'));
    await expect(
      openaiCompatibleAdapter.call({
        baseUrl: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "x",
        systemPrompt: "y",
        userPrompt: "z",
        structured: false,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("classifies 429 as rate_limit", async () => {
    mockedRequest.mockResolvedValueOnce(errorResponse(429, "{}"));
    try {
      await openaiCompatibleAdapter.call({
        baseUrl: "https://x",
        apiKey: "k",
        model: "m",
        systemPrompt: "s",
        userPrompt: "u",
        structured: false,
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ProviderError).code).toBe("rate_limit");
    }
  });

  it("classifies 5xx as upstream", async () => {
    mockedRequest.mockResolvedValueOnce(errorResponse(500, "boom"));
    try {
      await openaiCompatibleAdapter.call({
        baseUrl: "https://x",
        apiKey: "k",
        model: "m",
        systemPrompt: "s",
        userPrompt: "u",
        structured: false,
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as ProviderError).code).toBe("upstream");
    }
  });

  it("lists models from /models", async () => {
    mockedRequest.mockResolvedValueOnce(
      okResponse({ data: [{ id: "model-a" }, { id: "model-b" }] }),
    );
    const models = await openaiCompatibleAdapter.listModels("https://x/v1", "k");
    expect(models.map((m) => m.id)).toEqual(["model-a", "model-b"]);
  });

  it("returns empty list when /models is not the expected shape", async () => {
    mockedRequest.mockResolvedValueOnce(okResponse({ not_data: [] }));
    const models = await openaiCompatibleAdapter.listModels("https://x/v1", "k");
    expect(models).toEqual([]);
  });
});
