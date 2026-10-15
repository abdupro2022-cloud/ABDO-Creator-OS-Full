import { describe, it, expect } from "vitest";

describe("client smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("JSON parsing in fences", () => {
    function extract(text: string): unknown {
      try { return JSON.parse(text); } catch { /* */ }
      const s = text.indexOf("{"); const e = text.lastIndexOf("}");
      if (s >= 0 && e > s) {
        try { return JSON.parse(text.slice(s, e + 1)); } catch { return text; }
      }
      return text;
    }
    expect(extract('{"a":1}')).toEqual({ a: 1 });
    expect(extract('noise {"a":2} more')).toEqual({ a: 2 });
  });
});
