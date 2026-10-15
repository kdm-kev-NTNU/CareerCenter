import { describe, expect, it } from "vitest";
import { prepPlanIntakeSchema } from "./knowledgeSchemas.js";

describe("prepPlanIntakeSchema", () => {
  it("defaults researchModel to gpt-6-astra", () => {
    const parsed = prepPlanIntakeSchema.parse({ companyName: "DNB" });
    expect(parsed.researchModel).toBe("gpt-6-astra");
    expect(parsed.format).toBe("interview");
    expect(parsed.jobAdText).toBe("");
  });

  it("accepts jobAdText up to 20000 chars and rejects longer", () => {
    const ok = prepPlanIntakeSchema.parse({
      companyName: "DNB",
      jobAdText: "Vi søker en associate."
    });
    expect(ok.jobAdText).toContain("associate");
    expect(() =>
      prepPlanIntakeSchema.parse({
        companyName: "DNB",
        jobAdText: "x".repeat(20_001)
      })
    ).toThrow();
  });

  it("accepts catalog research models", () => {
    const parsed = prepPlanIntakeSchema.parse({
      companyName: "McKinsey",
      roleTitle: "Associate",
      researchModel: "gpt-5.5"
    });
    expect(parsed.researchModel).toBe("gpt-5.5");
  });

  it("rejects unknown research models", () => {
    expect(() =>
      prepPlanIntakeSchema.parse({
        companyName: "DNB",
        researchModel: "o3"
      })
    ).toThrow();
  });
});
