import { z } from "zod";

/**
 * ABDO Creator OS — shared Zod schemas.
 *
 * These schemas are the single source of truth for:
 *   - API request/response boundaries
 *   - Provider configuration
 *   - Agent output contracts
 *   - Skill definitions
 *   - Research artifacts
 *
 * Both server and client import from here. Zod is used because
 * it gives us type + runtime validation in one place.
 */

// --------------------------------------------------------------------
// Provider
// --------------------------------------------------------------------

export const ProviderKindSchema = z.enum([
  "openai_compatible",
  "anthropic",
  "google",
  "custom",
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const ProviderCapabilitySchema = z.enum([
  "text",
  "structured",
  "tool_calling",
  "image_input",
  "image_generation",
  "audio",
  "video_understanding",
  "embeddings",
  "streaming",
  "reasoning",
]);
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>;

export const ProviderCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ProviderKindSchema,
  description: z.string(),
  baseUrl: z.string().url().optional(),
  implemented: z.boolean(),
  capabilities: z.array(ProviderCapabilitySchema),
  notes: z.string().optional(),
  /** Whether model discovery is supported. */
  modelDiscovery: z.boolean(),
});
export type ProviderCatalogEntry = z.infer<typeof ProviderCatalogEntrySchema>;

/** What the user POSTs to /api/providers when adding a personal config. */
export const UserProviderConfigInputSchema = z.object({
  catalogId: z.string().min(1),
  label: z.string().min(1).max(80),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
});
export type UserProviderConfigInput = z.infer<typeof UserProviderConfigInputSchema>;

/** What the server returns for a stored user provider. Never contains the key. */
export const UserProviderViewSchema = z.object({
  id: z.string(),
  catalogId: z.string(),
  label: z.string(),
  baseUrl: z.string().nullable(),
  defaultModel: z.string().nullable(),
  enabled: z.boolean(),
  hasKey: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProviderView = z.infer<typeof UserProviderViewSchema>;

// --------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------

export const SignUpInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80).optional(),
});
export type SignUpInput = z.infer<typeof SignUpInputSchema>;

export const SignInInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type SignInInput = z.infer<typeof SignInInputSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: z.enum(["user", "admin"]),
  createdAt: z.string(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

// --------------------------------------------------------------------
// Projects
// --------------------------------------------------------------------

export const ProjectInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// --------------------------------------------------------------------
// Conversations & tasks
// --------------------------------------------------------------------

export const ConversationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

// --------------------------------------------------------------------
// Agent orchestrator
// --------------------------------------------------------------------

export const AgentRoleSchema = z.enum([
  "advocate",
  "critic",
  "synthesizer",
  "business_analyst",
  "reviewer",
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(20_000),
  providerConfigId: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  /** Optional role-specific instructions appended to the system prompt. */
  roleGuidance: z.string().max(2000).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Structured output from a single LLM turn. */
export const AgentTurnOutputSchema = z.object({
  status: z.enum(["ok", "partial", "needs_clarification", "error"]),
  summary: z.string(),
  key_points: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  next_actions: z.array(z.string()).default([]),
});
export type AgentTurnOutput = z.infer<typeof AgentTurnOutputSchema>;

export const ChatResponseSchema = z.object({
  providerId: z.string(),
  model: z.string(),
  role: AgentRoleSchema,
  output: AgentTurnOutputSchema,
  usage: z
    .object({
      promptTokens: z.number().int().nullable(),
      completionTokens: z.number().int().nullable(),
      totalTokens: z.number().int().nullable(),
      source: z.enum(["provider", "estimated", "unknown"]),
    })
    .nullable(),
  rawText: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// --------------------------------------------------------------------
// Skills
// --------------------------------------------------------------------

export const SkillPermissionSchema = z.enum([
  "read:own_projects",
  "read:own_conversations",
  "read:own_research",
  "write:own_projects",
  "write:own_conversations",
  "use:providers",
  "publish:community",
  "execute:code_sandbox",
]);
export type SkillPermission = z.infer<typeof SkillPermissionSchema>;

/** Tool call a Skill is allowed to make. Free-form tool name is NOT permitted. */
export const SkillAllowedToolSchema = z.enum([
  "providers.chat",
  "providers.test",
  "research.search",
  "research.extract",
  "scripts.create",
  "scripts.revise",
]);
export type SkillAllowedTool = z.infer<typeof SkillAllowedToolSchema>;

export const SkillDefinitionSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),
  authorId: z.string().nullable(),
  category: z.string().min(1).max(60),
  description: z.string().max(2000),
  systemPrompt: z.string().max(20_000),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  requiredCapabilities: z.array(ProviderCapabilitySchema).default([]),
  permissions: z.array(SkillPermissionSchema).default([]),
  allowedTools: z.array(SkillAllowedToolSchema).default([]),
  /** A skill may NOT contain executable code; it may only declare declarative instructions. */
  executable: z.literal(false).default(false),
  enabled: z.boolean().default(true),
  builtIn: z.boolean().default(false),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

/** Loose input used by the UI when creating a skill. The server fills in the rest. */
export const SkillCreateInputSchema = SkillDefinitionSchema.partial({
  id: true,
  authorId: true,
  builtIn: true,
  enabled: true,
  executable: true,
}).refine((v) => v.executable === false || v.executable === undefined, {
  message: "Skills must be declarative (executable=false).",
  path: ["executable"],
});
export type SkillCreateInput = z.infer<typeof SkillCreateInputSchema>;

// --------------------------------------------------------------------
// Research
// --------------------------------------------------------------------

export const ResearchSourceSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  publicationDate: z.string().nullable(),
  retrievedAt: z.string(),
  reliability: z.enum(["high", "medium", "low", "unknown"]).default("unknown"),
  notes: z.string().optional(),
  excerpt: z.string().optional(),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum([
    "verified",
    "supported",
    "unverified",
    "conflicting",
    "inference",
    "speculation",
  ]),
  supportingSourceUrls: z.array(z.string().url()).default([]),
  conflictingSourceUrls: z.array(z.string().url()).default([]),
  notes: z.string().optional(),
});
export type ResearchClaim = z.infer<typeof ResearchClaimSchema>;

export const ResearchReportSchema = z.object({
  id: z.string(),
  query: z.string(),
  summary: z.string(),
  sources: z.array(ResearchSourceSchema),
  claims: z.array(ResearchClaimSchema),
  factCheckNotes: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type ResearchReport = z.infer<typeof ResearchReportSchema>;

// --------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
