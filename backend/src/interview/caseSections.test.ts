import { describe, expect, it } from "vitest";
import { parseCaseSections } from "./caseSections.js";

describe("parseCaseSections", () => {
  it("splits marked sections", () => {
    const content = ["Prompt:", "What should the client do?", "Solution:", "Expand to new markets."].join("\n");
    const parsed = parseCaseSections(content);
    expect(parsed.prompt).toContain("What should");
    expect(parsed.solution).toContain("Expand");
  });
});
