import { describe, it, expect } from "vitest";
import { AgentTurnOutputSchema, SignUpInputSchema } from "@abdo/shared";

describe("agent output schema", () => {
  it("accepts a well-formed object", () => {
    const r = AgentTurnOutputSchema.safeParse({
      status: "ok",
      summary: "x",
      key_points: ["a"],
      recommendations: ["b"],
      assumptions: [],
      risks: [],
      confidence: 0.7,
      next_actions: ["go"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range confidence", () => {
    const r = AgentTurnOutputSchema.safeParse({
      status: "ok",
      summary: "x",
      key_points: [],
      recommendations: [],
      assumptions: [],
      risks: [],
      confidence: 2,
      next_actions: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown status", () => {
    const r = AgentTurnOutputSchema.safeParse({
      status: "amazing",
      summary: "x",
      key_points: [],
      recommendations: [],
      assumptions: [],
      risks: [],
      confidence: 0.5,
      next_actions: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("signup schema", () => {
  it("requires a valid email and 8+ char password", () => {
    expect(SignUpInputSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true);
    expect(SignUpInputSchema.safeParse({ email: "not-an-email", password: "12345678" }).success).toBe(false);
    expect(SignUpInputSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});
