import { describe, expect, it } from "vitest";
import { starRubricCriteria } from "@careercenter/shared";
import { interviewFeedbackRubricSchema, sumRubricScores } from "./feedbackRubric.js";

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
