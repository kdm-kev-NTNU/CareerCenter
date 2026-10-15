import {
  abilityTestKinds,
  videoSimStates,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import { z } from "zod";
import { interviewFeedbackRubricSchema } from "./feedbackRubric.js";

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
  withRubric: z.string().optional().default("false")
});

export function parseMultipartBool(value: string | undefined): boolean {
  return value === "true" || value === "1";
}
