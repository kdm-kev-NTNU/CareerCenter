import {
  averageStarSum,
  type InterviewAbilityTestAttemptDto,
  type InterviewCaseRepertoireLogDto,
  type InterviewStoryBankEntryDto,
  type InterviewStoryScoreDto,
  type InterviewVideoRunDto,
  type InterviewVideoSettingsDto,
  type StarRubricCriterion,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import type {
  InterviewAbilityTestAttemptRecord,
  InterviewCaseRepertoireLogRecord,
  InterviewStoryBankEntryRecord,
  InterviewStoryScoreRecord,
  InterviewVideoRunRecord,
  InterviewVideoSettingsRecord
} from "../interviewPrepRepository.js";

export function toStoryDto(
  story: InterviewStoryBankEntryRecord,
  scores: InterviewStoryScoreRecord[]
): InterviewStoryBankEntryDto {
  const history = scores.map((score) => ({
    scores: score.scores,
    sum: score.sum,
    createdAt: score.createdAt
  }));
  const latest = scores[0];
  return {
    id: story.id,
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    tags: story.tags,
    latestSum: latest?.sum,
    averageSum: averageStarSum(history),
    createdAt: story.createdAt,
    updatedAt: story.updatedAt
  };
}

export function toStoryScoreDto(score: InterviewStoryScoreRecord): InterviewStoryScoreDto {
  return {
    id: score.id,
    storyId: score.storyId,
    scores: score.scores,
    sum: score.sum,
    note: score.note,
    createdAt: score.createdAt
  };
}

export function toRepertoireDto(row: InterviewCaseRepertoireLogRecord): InterviewCaseRepertoireLogDto {
  return {
    id: row.id,
    caseEntryId: row.caseEntryId,
    title: row.title,
    outcome: row.outcome,
    notes: row.notes,
    practicedAt: row.practicedAt
  };
}

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

export function parseStarScores(json: string): Record<StarRubricCriterion, number> {
  return JSON.parse(json) as Record<StarRubricCriterion, number>;
}
