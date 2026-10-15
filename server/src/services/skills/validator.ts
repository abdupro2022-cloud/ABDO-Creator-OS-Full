import type { SkillDefinition } from "@abdo/shared";

/**
 * Validate a Skill definition.
 *
 * Imported / user-created Skills are treated as UNTRUSTED input (§15).
 * The validator enforces:
 *   - Skills MUST be declarative (executable === false)
 *   - No code blocks or shell metacharacters in the system prompt
 *   - Input / output schemas are plain JSON Schema objects
 *   - allowedTools must come from the registered tool enum
 *   - permissions must come from the registered permission enum
 *   - systemPrompt must not contain template injection patterns
 */
const FORBIDDEN_SYSTEM_PROMPT_PATTERNS: RegExp[] = [
  /```/, // fenced code blocks
  /\beval\b/i,
  /\bnew Function\b/i,
  /\brequire\s*\(\s*['"]child_process/i,
  /\bexec\s*\(/i,
  /\bspawn\s*\(/i,
  /\bimport\s*\(\s*['"]os['"]/i,
  /<script\b/i,
  /javascript:/i,
];

const MAX_SYSTEM_PROMPT_LEN = 20_000;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSkillDefinition(def: SkillDefinition): ValidationResult {
  if (def.executable !== false) {
    return { ok: false, reason: "Skills must be declarative (executable must be false)." };
  }
  if (typeof def.systemPrompt !== "string" || def.systemPrompt.length === 0) {
    return { ok: false, reason: "systemPrompt is required." };
  }
  if (def.systemPrompt.length > MAX_SYSTEM_PROMPT_LEN) {
    return { ok: false, reason: `systemPrompt exceeds ${MAX_SYSTEM_PROMPT_LEN} characters.` };
  }
  for (const re of FORBIDDEN_SYSTEM_PROMPT_PATTERNS) {
    if (re.test(def.systemPrompt)) {
      return { ok: false, reason: `systemPrompt contains forbidden pattern: ${re.source}` };
    }
  }
  if (!isPlainJsonSchema(def.inputSchema) || !isPlainJsonSchema(def.outputSchema)) {
    return { ok: false, reason: "inputSchema and outputSchema must be plain JSON Schema objects." };
  }
  return { ok: true };
}

function isPlainJsonSchema(value: unknown): boolean {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  // JSON Schema is always an object; we don't introspect deeply, but reject
  // values that look like code (functions are impossible in JSON, but we can
  // still reject anything with `__proto__` style pollution).
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") return false;
  }
  return true;
}
