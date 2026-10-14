import {
  abilityTestKinds,
  starRubricCriteria,
  videoSimStates,
  videoSimulatorSettingsSchema,
  type StarRubricCriterion
} from "@careercenter/shared";
import { z } from "zod";

export const storyBankInputSchema = z.object({
  title: z.string().min(1),
  situation: z.string().default(""),
  task: z.string().default(""),
  action: z.string().default(""),
  result: z.string().default(""),
  tags: z.array(z.string()).default([])
});

const storyScoreValueSchema = z.number().int().min(1).max(5);

const storyScoresShape = Object.fromEntries(
  starRubricCriteria.map((key) => [key, storyScoreValueSchema])
) as Record<StarRubricCriterion, typeof storyScoreValueSchema>;

export const storyScoreInputSchema = z.object({
  scores: z.object(storyScoresShape),
  note: z.string().default("")
});

export const repertoireLogInputSchema = z.object({
  caseEntryId: z.string().optional(),
  title: z.string().min(1),
  outcome: z.string().default(""),
  notes: z.string().default(""),
  practicedAt: z.string().datetime().optional()
});

export const abilityAttemptInputSchema = z.object({
  kind: z.enum(abilityTestKinds),
  seed: z.number().int(),
  correct: z.boolean(),
  durationMs: z.number().int().min(0)
});

export const videoRunInputSchema = z.object({
  state: z.enum(videoSimStates).default("done"),
  cardIndex: z.number().int().optional(),
  blobKey: z.string().optional(),
  transcript: z.string().default(""),
  settings: videoSimulatorSettingsSchema
});

export const transcriptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});

export const videoTranscribeStubSchema = z.object({
  blobKey: z.string().optional(),
  note: z.string().default("")
});
