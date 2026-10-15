import { describe, expect, it } from "vitest";
import { starRubricCriteria } from "@careercenter/shared";
import {
  interviewFeedbackRubricSchema,
  llmRubricOutputSchema,
  sumRubricScores,
  toFeedbackRubric
} from "./feedbackRubric.js";

describe("interviewFeedbackRubricSchema", () => {
  it("requires scores 1–4 and matching sum", () => {
    const scores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;
    const payload = {
      scores,
      sum: sumRubricScores(scores),
      improvement: "Vær mer konkret på resultat."
    };
    expect(interviewFeedbackRubricSchema.parse(payload).sum).toBe(24);
  });

  it("rejects wrong sum", () => {
    const scores = Object.fromEntries(starRubricCriteria.map((key) => [key, 2])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;
    expect(() =>
      interviewFeedbackRubricSchema.parse({
        scores,
        sum: 99,
        improvement: "Test"
      })
    ).toThrow(/Sum må være/);
  });
});

describe("llmRubricOutputSchema and toFeedbackRubric", () => {
  it("computes sum server-side from LLM output without sum", () => {
    const scores = Object.fromEntries(starRubricCriteria.map((key) => [key, 4])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;
    const output = llmRubricOutputSchema.parse({
      scores,
      improvement: "Bra tempo."
    });
    const feedback = toFeedbackRubric(output);
    expect(feedback.sum).toBe(32);
    expect(feedback.improvement).toBe("Bra tempo.");
  });

  it("ignores wrong LLM sum if present (sum is not part of LLM contract)", () => {
    const scores = Object.fromEntries(starRubricCriteria.map((key) => [key, 2])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;
    const output = llmRubricOutputSchema.parse({
      scores,
      sum: 99,
      improvement: "Mer konkret."
    });
    expect(toFeedbackRubric(output).sum).toBe(16);
  });
});
