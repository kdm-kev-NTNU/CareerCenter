import {
  abilityTestKinds,
  videoSimStates,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import { z } from "zod";

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
  note: z.string().default(""),
  audioBase64: z.string().optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  durationMs: z.number().int().min(0).optional(),
  withRubric: z.boolean().optional().default(false)
});
