import { request } from "undici";
import type { ProviderCatalogEntry, ProviderCapability } from "@abdo/shared";

export interface ProviderCallInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  /** When true, ask the model to return JSON matching the schema. */
  structured: boolean;
  timeoutMs?: number;
}

export interface ProviderCallResult {
  text: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    source: "provider" | "estimated" | "unknown";
  };
  warnings: string[];
}

export interface ProviderModel {
  id: string;
  ownedBy?: string;
}

export class ProviderError extends Error {
  constructor(
    public readonly code:
      | "invalid_key"
      | "rate_limit"
      | "quota"
      | "network"
      | "timeout"
      | "upstream"
      | "schema"
      | "unknown",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function classifyStatus(status: number, body: string): ProviderError["code"] {
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status === 402) return "quota";
  if (status >= 500) return "upstream";
  return "unknown";
}

function withSlash(u: string): string {
  return u.endsWith("/") ? u : u + "/";
}

function joinUrl(base: string, path: string): string {
  const b = withSlash(base);
  return new URL(path, b).toString();
}

function capabilitiesFor(entry: ProviderCatalogEntry): ProviderCapability[] {
  return entry.capabilities;
}

export const openaiCompatibleAdapter = {
  capabilitiesFor,
  async call(input: ProviderCallInput): Promise<ProviderCallResult> {
    const url = joinUrl(input.baseUrl, "chat/completions");
    const body: Record<string, unknown> = {
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.structured) {
      // Encourage JSON; we still validate with Zod and bounded-repair on failure.
      body.response_format = { type: "json_object" };
    }
    let res;
    try {
      res = await request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify(body),
        headersTimeout: input.timeoutMs ?? 30_000,
        bodyTimeout: input.timeoutMs ?? 30_000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/timeout/i.test(message)) {
        throw new ProviderError("timeout", `Provider request timed out: ${message}`);
      }
      throw new ProviderError("network", `Provider request failed: ${message}`);
    }
    const text = await res.body.text();
    if (res.statusCode >= 400) {
      const code = classifyStatus(res.statusCode, text);
      // Trim body for logs but include enough context in the error
      const excerpt = text.slice(0, 500);
      throw new ProviderError(code, `Provider returned ${res.statusCode}: ${excerpt}`, res.statusCode);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ProviderError("upstream", `Provider returned non-JSON: ${text.slice(0, 200)}`);
    }
    const choices = (parsed as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ProviderError("upstream", "Provider response missing choices.");
    }
    const first = choices[0] as { message?: { content?: unknown } };
    const content = first?.message?.content;
    const out = typeof content === "string" ? content : Array.isArray(content)
      ? content.map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : "")).join("")
      : "";
    const usage = (parsed as { usage?: Record<string, unknown> }).usage;
    let usageOut: ProviderCallResult["usage"] = {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      source: "unknown",
    };
    if (usage && typeof usage === "object") {
      const pt = usage.prompt_tokens;
      const ct = usage.completion_tokens;
      const tt = usage.total_tokens;
      usageOut = {
        promptTokens: typeof pt === "number" ? pt : null,
        completionTokens: typeof ct === "number" ? ct : null,
        totalTokens: typeof tt === "number" ? tt : null,
        source: "provider",
      };
    }
    return { text: out, usage: usageOut, warnings: [] };
  },

  async listModels(baseUrl: string, apiKey: string, timeoutMs = 15_000): Promise<ProviderModel[]> {
    const url = joinUrl(baseUrl, "models");
    let res;
    try {
      res = await request(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ProviderError("network", `Model discovery failed: ${message}`);
    }
    const text = await res.body.text();
    if (res.statusCode >= 400) {
      const code = classifyStatus(res.statusCode, text);
      throw new ProviderError(code, `Model discovery returned ${res.statusCode}: ${text.slice(0, 200)}`, res.statusCode);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ProviderError("upstream", "Model discovery returned non-JSON.");
    }
    const data = (parsed as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];
    return data
      .map((m): ProviderModel | null => {
        if (typeof m === "object" && m && "id" in m && typeof (m as { id: unknown }).id === "string") {
          const owned = (m as { owned_by?: unknown }).owned_by;
          return { id: String((m as { id: unknown }).id), ownedBy: typeof owned === "string" ? owned : undefined };
        }
        return null;
      })
      .filter((m): m is ProviderModel => m !== null);
  },
};
