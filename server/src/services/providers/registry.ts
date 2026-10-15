import type { ProviderCatalogEntry } from "@abdo/shared";

/**
 * The provider catalog.
 *
 * IMPORTANT: every entry here MUST honestly report `implemented` and `modelDiscovery`.
 * If a provider is in the catalog but not yet implemented, it shows in the UI
 * with a clear "not yet implemented" label — no false claims.
 *
 * Most modern providers expose an OpenAI-compatible `/v1/chat/completions`
 * endpoint, so a single OpenAI-compatible adapter covers many of them.
 * The Anthropic / Google / Cohere entries are honest placeholders for
 * Phase 2+ where provider-specific adapters will be added.
 */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai_compatible",
    description: "OpenAI API — gpt-4o, gpt-4o-mini, o1, etc.",
    baseUrl: "https://api.openai.com/v1",
    implemented: true,
    capabilities: ["text", "structured", "tool_calling", "image_input", "streaming", "reasoning"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai_compatible",
    description: "OpenRouter — access many models through one OpenAI-compatible endpoint.",
    baseUrl: "https://openrouter.ai/api/v1",
    implemented: true,
    capabilities: ["text", "structured", "tool_calling", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai_compatible",
    description: "DeepSeek API — deepseek-chat, deepseek-reasoner.",
    baseUrl: "https://api.deepseek.com/v1",
    implemented: true,
    capabilities: ["text", "structured", "tool_calling", "streaming", "reasoning"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai_compatible",
    description: "Groq — fast inference for Llama, Mixtral, Gemma.",
    baseUrl: "https://api.groq.com/openai/v1",
    implemented: true,
    capabilities: ["text", "structured", "tool_calling", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "together",
    name: "Together AI",
    kind: "openai_compatible",
    description: "Together AI — open models via OpenAI-compatible endpoint.",
    baseUrl: "https://api.together.xyz/v1",
    implemented: true,
    capabilities: ["text", "structured", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai_compatible",
    description: "Mistral AI — OpenAI-compatible surface available.",
    baseUrl: "https://api.mistral.ai/v1",
    implemented: true,
    capabilities: ["text", "structured", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    kind: "openai_compatible",
    description: "Perplexity Sonar — OpenAI-compatible endpoint with web-grounded answers.",
    baseUrl: "https://api.perplexity.ai",
    implemented: true,
    capabilities: ["text", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    kind: "openai_compatible",
    description: "Fireworks AI — fast open-model inference, OpenAI-compatible.",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    implemented: true,
    capabilities: ["text", "structured", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used.",
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    kind: "openai_compatible",
    description: "Any OpenAI-compatible endpoint — set baseUrl, model, and key yourself.",
    implemented: true,
    capabilities: ["text", "structured", "streaming"],
    modelDiscovery: false,
    notes: "User provides baseUrl and default model.",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    description: "Anthropic Claude — provider-specific adapter pending.",
    implemented: false,
    capabilities: ["text", "structured", "tool_calling", "image_input", "streaming", "reasoning"],
    modelDiscovery: false,
    notes: "Not yet implemented in Phase 1.",
  },
  {
    id: "google",
    name: "Google Gemini",
    kind: "google",
    description: "Google Gemini — provider-specific adapter pending.",
    implemented: false,
    capabilities: ["text", "structured", "tool_calling", "image_input", "video_understanding", "streaming"],
    modelDiscovery: false,
    notes: "Not yet implemented in Phase 1.",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    kind: "openai_compatible",
    description: "xAI Grok — OpenAI-compatible adapter pending verification.",
    baseUrl: "https://api.x.ai/v1",
    implemented: true,
    capabilities: ["text", "structured", "tool_calling", "streaming"],
    modelDiscovery: true,
    notes: "OpenAI-compatible adapter used. Verify with your account.",
  },
  {
    id: "cohere",
    name: "Cohere",
    kind: "custom",
    description: "Cohere — provider-specific adapter pending.",
    implemented: false,
    capabilities: ["text", "structured", "embeddings", "streaming"],
    modelDiscovery: false,
    notes: "Not yet implemented in Phase 1.",
  },
];

export function findCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}
