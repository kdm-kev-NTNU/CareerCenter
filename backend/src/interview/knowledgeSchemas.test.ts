import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import {
  bankQuestionExtractSchema,
  companyReportSchema,
  curatedBankSelectionSchema,
  essentialsDraftSchema,
  prepPlanIntakeSchema,
  questionCleanupResultSchema,
  simulatorSettingsSchema
} from "./knowledgeSchemas.js";

describe("LLM schemas", () => {
  it("convert to strict structured outputs", () => {
    for (const schema of [
      questionCleanupResultSchema,
      bankQuestionExtractSchema,
      curatedBankSelectionSchema,
      essentialsDraftSchema
    ]) {
      expect(() => zodTextFormat(schema, "structured_response")).not.toThrow();
    }
  });

  it("defaults reverse questions to an empty list in curation", () => {
    const parsed = curatedBankSelectionSchema.parse({ selectedQuestionIds: Array.from({ length: 30 }, (_, i) => `q${i}`) });
    expect(parsed.reverseQuestions).toEqual([]);
  });
});

describe("simulatorSettingsSchema", () => {
  it("accepts null essentials to reset to the default", () => {
    expect(simulatorSettingsSchema.parse({ mode: "case_oral", essentialsSheet: null }).essentialsSheet).toBeNull();
    expect(simulatorSettingsSchema.parse({ mode: "case_oral" }).essentialsSheet).toBeNull();
  });
});

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
