import type { AbilityTestKind } from "./abilityTests.js";
import type { StarRubricCriterion } from "./interviewPrep.js";
import type { VideoSimulatorSettings } from "./videoSimulatorSettings.js";
import type { VideoSimState } from "./videoSimState.js";

export interface InterviewStoryBankEntryDto {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
  latestSum?: number;
  averageSum?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewStoryScoreDto {
  id: string;
  storyId: string;
  scores: Record<StarRubricCriterion, number>;
  sum: number;
  note: string;
  createdAt: string;
}

export interface InterviewCaseRepertoireLogDto {
  id: string;
  caseEntryId?: string;
  title: string;
  company: string;
  format: string;
  tested: string;
  improvement: string;
  outcome: string;
  notes: string;
  practicedAt: string;
}

export interface InterviewAbilityTestAttemptDto {
  id: string;
  kind: AbilityTestKind;
  seed: number;
  correct: boolean;
  durationMs: number;
  createdAt: string;
}

export interface InterviewVideoSettingsDto extends VideoSimulatorSettings {
  updatedAt?: string;
}

export interface InterviewVideoRunDto {
  id: string;
  state: VideoSimState;
  cardIndex?: number;
  blobKey?: string;
  transcript: string;
  settings: VideoSimulatorSettings;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceSessionDto {
  mock: boolean;
  model: string;
  clientSecret: string;
  expiresAt: string;
  tools: Array<{ name: string; description: string }>;
}
