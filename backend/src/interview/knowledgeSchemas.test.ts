import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import {
  answerDraftBatchSchema,
  bankQuestionExtractSchema,
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

  it("defaults generated questions to an empty list in curation", () => {
    const parsed = curatedBankSelectionSchema.parse({
      selectedRefs: Array.from({ length: 30 }, (_, i) => `Q${i + 1}`)
    });
    expect(parsed.generatedQuestions).toEqual([]);
    expect(parsed.selectedRefs).toHaveLength(30);
    expect(parsed).not.toHaveProperty("reverseQuestions");
    expect(parsed).not.toHaveProperty("tasks");
  });

  it("accepts fewer than 30 selectedRefs (domain fill happens later)", () => {
    const parsed = curatedBankSelectionSchema.parse({ selectedRefs: ["Q1", "Q2"] });
    expect(parsed.selectedRefs).toEqual(["Q1", "Q2"]);
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

describe("answerDraftBatchSchema", () => {
  it("converts to strict structured outputs", () => {
    expect(() => zodTextFormat(answerDraftBatchSchema, "structured_response")).not.toThrow();
  });

  it("accepts a batch of answer drafts", () => {
    const parsed = answerDraftBatchSchema.parse({
      drafts: [
        { questionAlias: "Q1", exampleAnswer: "Jeg ville …", tips: ["Bruk STAR-metoden"] },
        { questionAlias: "Q2", exampleAnswer: "Mitt sterkeste …", tips: ["Vær konkret", "Gi eksempler"] }
      ]
    });
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts[0].tips).toEqual(["Bruk STAR-metoden"]);
  });

  it("rejects empty exampleAnswer", () => {
    expect(() =>
      answerDraftBatchSchema.parse({
        drafts: [{ questionAlias: "Q1", exampleAnswer: "", tips: ["tips"] }]
      })
    ).toThrow();
  });

  it("rejects empty tips array", () => {
    expect(() =>
      answerDraftBatchSchema.parse({
        drafts: [{ questionAlias: "Q1", exampleAnswer: "Svar", tips: [] }]
      })
    ).toThrow();
  });
});
