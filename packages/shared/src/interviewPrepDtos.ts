import type {
  CaseSourceKind,
  CaseStyle,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanStatus,
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
  createdAt: string;
  updatedAt: string;
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
  researchNotes: string;
  failureReason?: string;
  clarifications: InterviewPrepClarificationDto[];
  questions: InterviewPrepQuestionDto[];
  tasks: InterviewPrepTaskDto[];
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
