import type { CompanyProfile } from "./companyProfile.js";
import type { CompanyReport } from "./companyReport.js";
import type { PlanSectionKey } from "./planSections.js";
import type { PrepPlanPipelineStep } from "./prepPlanState.js";
import type {
  BankQuestionOrigin,
  BankQuestionStatus,
  CaseApprovalStatus,
  CaseSourceKind,
  CaseStyle,
  ImportJobKind,
  ImportJobStatus,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionAudience,
  QuestionCategory,
  QuestionDiscardReason,
  QuestionTarget,
  ResearchModel,
  StarRubricCriterion
} from "./interviewPrep.js";

export interface InterviewKnowledgeDocDto {
  id: string;
  kind: KnowledgeDocKind;
  title: string;
  content: string;
  sourceFilename?: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewCasePublicDto {
  id: string;
  title: string;
  prompt: string;
  sourceKind: CaseSourceKind;
  caseStyle?: CaseStyle;
  companyTags: string[];
  knowledgeDocId?: string;
  approvalStatus?: CaseApprovalStatus;
  originalFileKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewBankQuestionDto {
  id: string;
  knowledgeDocId: string;
  text: string;
  category: QuestionCategory;
  audience: QuestionAudience;
  status: BankQuestionStatus;
  discardReason?: QuestionDiscardReason;
  origin: BankQuestionOrigin;
  /** Text as first extracted from the document, before any cleanup rewrite. */
  sourceText: string;
  tags: string[];
  contentHash: string;
  /** Set once the cleanup agent (or the user) has reviewed the question. */
  cleanedAt?: string;
  createdAt: string;
}

export interface InterviewBankQuestionSummaryDto {
  byAudience: Record<QuestionAudience, number>;
  discarded: number;
  uncleaned: number;
}

export interface InterviewCaseEntryDto extends InterviewCasePublicDto {
  interviewerInfo: string;
  solution: string;
}

export interface InterviewPrepClarificationDto {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface InterviewPrepQuestionDto {
  id: string;
  text: string;
  category: QuestionCategory;
  audience: QuestionAudience;
  target: QuestionTarget;
  sortOrder: number;
  source: PrepQuestionSource;
  bankQuestionId?: string;
  storyId?: string;
  gapReason?: string;
  included: boolean;
  notes: string;
}

export interface InterviewPrepPlanDto {
  id: string;
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
  researchModel: ResearchModel;
  status: PrepPlanStatus;
  pipelineStep: PrepPlanPipelineStep;
  jobAdText: string;
  researchNotes: string;
  companyProfile?: CompanyProfile;
  companyReport?: CompanyReport;
  clarificationRound: number;
  curationFilledCount: number;
  failureReason?: string;
  clarifications: InterviewPrepClarificationDto[];
  questions: InterviewPrepQuestionDto[];
  repeatedStoryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewImportJobDto {
  id: string;
  knowledgeDocId: string;
  kind: ImportJobKind;
  status: ImportJobStatus;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSimulatorSettingsDto {
  mode: InterviewMode;
  companyName: string;
  tone: string;
  language: string;
  /** Effective sheet: the user's own text, or the default for the mode. */
  essentialsSheet: string;
  essentialsIsDefault: boolean;
}

/** Settings as saved by the client. `essentialsSheet: null` resets to the default. */
export interface InterviewSimulatorSettingsInput {
  mode: InterviewMode;
  companyName: string;
  tone: string;
  language: string;
  essentialsSheet: string | null;
}

export interface EssentialsDraftDto {
  draft: string;
  sourceDocTitles: string[];
}

export interface InterviewSessionDto {
  id: string;
  mode: InterviewMode;
  title: string;
  prepPlanId?: string;
  /** Set when the session practised one section of the plan instead of the whole interview. */
  planSection?: PlanSectionKey;
  finishedAt?: string;
  feedback?: InterviewSessionFeedbackDto;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewMessageDto {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface InterviewSessionFeedbackDto {
  scores: Record<StarRubricCriterion, number>;
  sum: number;
  improvement: string;
}
