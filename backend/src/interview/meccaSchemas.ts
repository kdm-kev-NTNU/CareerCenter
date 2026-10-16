import {
  abilityTestKinds,
  researchModels,
  videoSimStates,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import { z } from "zod";
import { interviewFeedbackRubricSchema } from "./feedbackRubric.js";

const optionalRatingModelSchema = z.enum(researchModels).optional();

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
  prompt: z.string().default(""),
  companyName: z.string().max(200).default(""),
  roleDescription: z.string().max(8000).default(""),
  feedback: interviewFeedbackRubricSchema.optional(),
  settings: videoSimulatorSettingsSchema
});

export const transcriptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});

/** Multipart fields for /video/transcribe (plus optional file part). */
export const videoTranscribeFieldsSchema = z.object({
  note: z.string().default(""),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  durationMs: z.coerce.number().int().min(0).optional(),
  prompt: z.string().default(""),
  withRubric: z.string().optional().default("false"),
  model: optionalRatingModelSchema
});

/** Body for POST /api/interview/video/rate (re-rate without re-uploading audio). */
export const videoRateBodySchema = z.object({
  prompt: z.string().default(""),
  transcript: z.string().min(1),
  durationMs: z.number().int().min(0).optional(),
  model: optionalRatingModelSchema
});

export function parseMultipartBool(value: string | undefined): boolean {
  return value === "true" || value === "1";
}
