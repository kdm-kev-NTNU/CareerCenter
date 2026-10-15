import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { companyReportSchema, prepPlanIntakeSchema } from "./knowledgeSchemas.js";

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

describe("companyReportSchema", () => {
  it("converts to strict structured outputs", () => {
    expect(() => zodTextFormat(companyReportSchema, "structured_response")).not.toThrow();
  });

  it("fills missing key facts with empty strings", () => {
    const parsed = companyReportSchema.parse({});
    expect(parsed.keyFacts).toEqual({
      industry: "",
      headquarters: "",
      size: "",
      ownership: ""
    });
    expect(parsed.headline).toBe("");
    expect(parsed.nicheInsights).toEqual([]);
  });

  it("keeps a provided key fact and defaults the rest", () => {
    const parsed = companyReportSchema.parse({ keyFacts: { industry: "Bank" } });
    expect(parsed.keyFacts).toEqual({
      industry: "Bank",
      headquarters: "",
      size: "",
      ownership: ""
    });
  });
});
