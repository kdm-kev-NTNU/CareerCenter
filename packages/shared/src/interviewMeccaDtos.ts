import type { AbilityTestKind } from "./abilityTests.js";
import type { AnswerStats } from "./answerStats.js";
import type { InterviewSessionFeedbackDto } from "./interviewPrepDtos.js";
import type { VideoSimulatorSettings } from "./videoSimulatorSettings.js";
import type { VideoSimState } from "./videoSimState.js";

export type VideoRatingStatus = "ok" | "unavailable" | "skipped";

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
  prompt: string;
  feedback?: InterviewSessionFeedbackDto;
  settings: VideoSimulatorSettings;
  createdAt: string;
  updatedAt: string;
}

export interface VideoTranscribeResultDto {
  mock: boolean;
  transcript: string;
  stats?: AnswerStats;
  feedback: InterviewSessionFeedbackDto | null;
  rating: VideoRatingStatus;
}

export interface VideoRateResultDto {
  stats?: AnswerStats;
  feedback: InterviewSessionFeedbackDto | null;
  rating: Exclude<VideoRatingStatus, "skipped">;
}

export interface VoiceSessionDto {
  mock: boolean;
  model: string;
  clientSecret: string;
  expiresAt: string;
  tools: Array<{ name: string; description: string }>;
}
