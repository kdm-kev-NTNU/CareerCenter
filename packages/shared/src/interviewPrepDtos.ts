import type { CompanyProfile } from "./companyProfile.js";
import type { PrepPlanPipelineStep } from "./prepPlanState.js";
import type {
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
  QuestionCategory,
  QuestionTarget,
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
  tags: string[];
  contentHash: string;
  createdAt: string;
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
  target: QuestionTarget;
  sortOrder: number;
  source: PrepQuestionSource;
  bankQuestionId?: string;
  storyId?: string;
  gapReason?: string;
  included: boolean;
  notes: string;
}

export interface InterviewPrepPlanCaseDto {
  id: string;
  caseEntryId: string;
  title: string;
  prompt: string;
  sourceKind: CaseSourceKind;
  sortOrder: number;
}

export interface InterviewPrepTaskDto {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  done: boolean;
}

export interface InterviewPrepPlanDto {
  id: string;
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
  status: PrepPlanStatus;
  pipelineStep: PrepPlanPipelineStep;
  researchNotes: string;
  companyProfile?: CompanyProfile;
  clarificationRound: number;
  failureReason?: string;
  clarifications: InterviewPrepClarificationDto[];
  questions: InterviewPrepQuestionDto[];
  tasks: InterviewPrepTaskDto[];
  recommendedCases: InterviewPrepPlanCaseDto[];
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
  essentialsSheet: string;
}

export interface InterviewSessionDto {
  id: string;
  mode: InterviewMode;
  title: string;
  prepPlanId?: string;
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
