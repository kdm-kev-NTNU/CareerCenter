import { starRubricCriteria, type StarRubricCriterion } from "@careercenter/shared";
import { z } from "zod";

const scoreSchema = z.number().int().min(1).max(4);

const scoresShape = Object.fromEntries(starRubricCriteria.map((key) => [key, scoreSchema])) as Record<
  StarRubricCriterion,
  typeof scoreSchema
>;

/** Schema sent to the LLM — sum is derived server-side, not asked of the model. */
export const llmRubricOutputSchema = z.object({
  scores: z.object(scoresShape),
  improvement: z.string().min(1)
});

export type LlmRubricOutput = z.infer<typeof llmRubricOutputSchema>;

/** Domain rubric with computed sum invariant. Used to validate stored/client feedback. */
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

export function toFeedbackRubric(output: LlmRubricOutput): InterviewFeedbackRubric {
  return interviewFeedbackRubricSchema.parse({
    scores: output.scores,
    sum: sumRubricScores(output.scores),
    improvement: output.improvement
  });
}
