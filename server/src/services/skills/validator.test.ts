import { describe, it, expect } from "vitest";
import { validateSkillDefinition } from "./validator.js";
import type { SkillDefinition } from "@abdo/shared";

function makeSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: "skill.test",
    name: "Test",
    version: "1.0.0",
    authorId: null,
    category: "test",
    description: "Test skill",
    systemPrompt: "You are a test skill. Return a JSON object.",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    requiredCapabilities: ["text"],
    permissions: ["read:own_projects"],
    allowedTools: ["providers.chat"],
    executable: false,
    enabled: true,
    builtIn: false,
    ...overrides,
  };
}

describe("skills/validator", () => {
  it("accepts a safe skill", () => {
    const r = validateSkillDefinition(makeSkill());
    expect(r.ok).toBe(true);
  });

  it("rejects executable=true", () => {
    const r = validateSkillDefinition(makeSkill({ executable: true as unknown as false }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/declarative/);
  });

  it("rejects fenced code blocks in systemPrompt", () => {
    const r = validateSkillDefinition(makeSkill({ systemPrompt: "Do this:\n```js\nconsole.log(1)\n```" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/forbidden/);
  });

  it("rejects shell exec patterns", () => {
    const r = validateSkillDefinition(makeSkill({ systemPrompt: "Use exec('rm -rf /') somewhere." }));
    expect(r.ok).toBe(false);
  });

  it("rejects empty systemPrompt", () => {
    const r = validateSkillDefinition(makeSkill({ systemPrompt: "" }));
    expect(r.ok).toBe(false);
  });

  it("rejects oversized systemPrompt", () => {
    const r = validateSkillDefinition(makeSkill({ systemPrompt: "x".repeat(20_001) }));
    expect(r.ok).toBe(false);
  });

  it("rejects prototype pollution in input schema", () => {
    // Use defineProperty to make `__proto__` an own enumerable string key, which is what
    // a malicious JSON payload could (in principle) attempt. JSON.parse won't normally
    // produce this shape, but we want the validator to defend against it.
    const malicious = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(malicious, "type", { value: "object", enumerable: true });
    Object.defineProperty(malicious, "__proto__", { value: { polluted: true }, enumerable: true });
    const r = validateSkillDefinition(makeSkill({ inputSchema: malicious }));
    expect(r.ok).toBe(false);
  });
});
