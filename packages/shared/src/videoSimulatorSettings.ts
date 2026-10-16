import { z } from "zod";
import { DEFAULT_RESEARCH_MODEL, researchModels } from "./interviewPrep.js";

export const VIDEO_QUESTION_COUNT_MIN = 1;
export const VIDEO_QUESTION_COUNT_MAX = 10;
export const DEFAULT_VIDEO_QUESTION_COUNT = 3;

const questionCountSchema = z
  .number()
  .int()
  .min(VIDEO_QUESTION_COUNT_MIN)
  .max(VIDEO_QUESTION_COUNT_MAX)
  .default(DEFAULT_VIDEO_QUESTION_COUNT);

export const videoSimulatorSettingsSchema = z.object({
  thinkSeconds: z.number().int().min(5).max(180).default(30),
  answerSeconds: z.number().int().min(15).max(600).default(90),
  questionCount: questionCountSchema,
  ratingModel: z.enum(researchModels).default(DEFAULT_RESEARCH_MODEL)
});

export type VideoSimulatorSettings = z.infer<typeof videoSimulatorSettingsSchema>;

export const defaultVideoSimulatorSettings: VideoSimulatorSettings = {
  thinkSeconds: 30,
  answerSeconds: 90,
  questionCount: DEFAULT_VIDEO_QUESTION_COUNT,
  ratingModel: DEFAULT_RESEARCH_MODEL
};

export const videoQuestionRequestSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  roleDescription: z.string().trim().max(8000).default(""),
  count: questionCountSchema,
  model: z.enum(researchModels).optional()
});

export type VideoQuestionRequest = z.infer<typeof videoQuestionRequestSchema>;

export interface VideoQuestionsDto {
  questions: string[];
}
