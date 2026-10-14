import { starRubricCriteria, type StarRubricCriterion } from "@careercenter/shared";
import { z } from "zod";

const scoreSchema = z.number().int().min(1).max(4);

const scoresShape = Object.fromEntries(starRubricCriteria.map((key) => [key, scoreSchema])) as Record<
  StarRubricCriterion,
  typeof scoreSchema
>;

export const interviewFeedbackRubricSchema = z
  .object({
    scores: z.object(scoresShape),
    sum: z.number().int(),
    improvement: z.string().min(1)
  })
  .superRefine((value, ctx) => {
    const computed = starRubricCriteria.reduce((total, key) => total + value.scores[key], 0);
    if (computed !== value.sum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sum må være ${computed}, ikke ${value.sum}`,
        path: ["sum"]
      });
    }
  });

export type InterviewFeedbackRubric = z.infer<typeof interviewFeedbackRubricSchema>;

export function sumRubricScores(scores: Record<StarRubricCriterion, number>): number {
  return starRubricCriteria.reduce((total, key) => total + scores[key], 0);
}
