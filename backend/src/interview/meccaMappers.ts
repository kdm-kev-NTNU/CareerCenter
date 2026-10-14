import {
  type InterviewAbilityTestAttemptDto,
  type InterviewVideoRunDto,
  type InterviewVideoSettingsDto,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import type {
  InterviewAbilityTestAttemptRecord,
  InterviewVideoRunRecord,
  InterviewVideoSettingsRecord
} from "../interviewPrepRepository.js";

export function toAbilityAttemptDto(row: InterviewAbilityTestAttemptRecord): InterviewAbilityTestAttemptDto {
  return {
    id: row.id,
    kind: row.kind,
    seed: row.seed,
    correct: row.correct,
    durationMs: row.durationMs,
    createdAt: row.createdAt
  };
}

export function toVideoSettingsDto(row: InterviewVideoSettingsRecord): InterviewVideoSettingsDto {
  const settings = videoSimulatorSettingsSchema.parse({
    thinkSeconds: row.thinkSeconds,
    answerSeconds: row.answerSeconds,
    prompts: JSON.parse(row.promptsJson) as string[]
  });
  return { ...settings, updatedAt: row.updatedAt };
}

export function toVideoRunDto(row: InterviewVideoRunRecord): InterviewVideoRunDto {
  return {
    id: row.id,
    state: row.state,
    cardIndex: row.cardIndex,
    blobKey: row.blobKey,
    transcript: row.transcript,
    settings: videoSimulatorSettingsSchema.parse(JSON.parse(row.settingsJson)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
