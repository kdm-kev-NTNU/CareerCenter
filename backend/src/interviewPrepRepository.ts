import type {
  AbilityTestKind,
  CaseApprovalStatus,
  CaseSourceKind,
  CaseStyle,
  ImportJobKind,
  ImportJobStatus,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanPipelineStep,
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionCategory,
  QuestionTarget,
  VideoSimState,
  VideoSimulatorSettings
} from "@careercenter/shared";
import type { InterviewFeedbackRubric } from "./interview/feedbackRubric.js";

export interface InterviewKnowledgeDoc {
  id: string;
  userId: string;
  kind: KnowledgeDocKind;
  title: string;
  content: string;
  sourceFilename?: string;
  originalFileKey?: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewCaseEntryRecord {
  id: string;
  userId: string;
  knowledgeDocId?: string;
  title: string;
  prompt: string;
  interviewerInfo: string;
  solution: string;
  sourceKind: CaseSourceKind;
  caseStyle?: CaseStyle;
  companyTags: string[];
  contentHash: string;
  approvalStatus: CaseApprovalStatus;
  originalFileKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewBankQuestionRecord {
  id: string;
  userId: string;
  knowledgeDocId: string;
  text: string;
  category: QuestionCategory;
  tags: string[];
  contentHash: string;
  createdAt: string;
}

export interface InterviewPrepClarificationRecord {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface InterviewPrepQuestionRecord {
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

export interface InterviewPrepPlanCaseRecord {
  id: string;
  caseEntryId: string;
  title: string;
  prompt: string;
  sourceKind: CaseSourceKind;
  sortOrder: number;
}

export interface InterviewPrepTaskRecord {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  done: boolean;
}

export interface InterviewPrepPlanRecord {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
  status: PrepPlanStatus;
  pipelineStep: PrepPlanPipelineStep;
  researchNotes: string;
  companyProfileJson: string;
  clarificationRound: number;
  failureReason?: string;
  clarifications: InterviewPrepClarificationRecord[];
  questions: InterviewPrepQuestionRecord[];
  tasks: InterviewPrepTaskRecord[];
  recommendedCases: InterviewPrepPlanCaseRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewImportJobRecord {
  id: string;
  userId: string;
  knowledgeDocId: string;
  kind: ImportJobKind;
  status: ImportJobStatus;
  progress: number;
  message: string;
  resultJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewSimulatorSettingsRecord {
  userId: string;
  mode: InterviewMode;
  companyName: string;
  tone: string;
  language: string;
  essentialsSheet: string;
}

export interface InterviewSessionRecord {
  id: string;
  userId: string;
  mode: InterviewMode;
  title: string;
  prepPlanId?: string;
  caseEntryId?: string;
  feedback?: InterviewFeedbackRubric;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewMessageRecord {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface InterviewAbilityTestAttemptRecord {
  id: string;
  userId: string;
  kind: AbilityTestKind;
  seed: number;
  correct: boolean;
  durationMs: number;
  createdAt: string;
}

export interface AbilityAttemptInput {
  kind: AbilityTestKind;
  seed: number;
  correct: boolean;
  durationMs: number;
}

export interface InterviewVideoSettingsRecord {
  userId: string;
  thinkSeconds: number;
  answerSeconds: number;
  promptsJson: string;
  updatedAt: string;
}

export interface InterviewVideoRunRecord {
  id: string;
  userId: string;
  settingsJson: string;
  state: VideoSimState;
  cardIndex?: number;
  blobKey?: string;
  transcript: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRunInput {
  state: VideoSimState;
  cardIndex?: number;
  blobKey?: string;
  transcript: string;
  settings: VideoSimulatorSettings;
}

export interface KnowledgeDocInput {
  kind?: KnowledgeDocKind;
  title: string;
  content: string;
  sourceFilename?: string;
  originalFileKey?: string;
  contentHash: string;
}

export interface CaseEntryInput {
  title: string;
  prompt: string;
  interviewerInfo: string;
  solution: string;
  sourceKind: CaseSourceKind;
  caseStyle?: CaseStyle;
  companyTags: string[];
  knowledgeDocId?: string;
  contentHash: string;
  approvalStatus?: CaseApprovalStatus;
  originalFileKey?: string;
}

export interface PrepPlanCreateInput {
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
}

export interface ImportJobCreateInput {
  knowledgeDocId: string;
  kind?: ImportJobKind;
}

export interface ImportJobUpdateInput {
  status?: ImportJobStatus;
  progress?: number;
  message?: string;
  resultJson?: string;
}

export interface PlanQuestionPatchInput {
  text?: string;
  category?: QuestionCategory;
  notes?: string;
  included?: boolean;
  source?: PrepQuestionSource;
}

export interface PlanQuestionCreateInput {
  text: string;
  category: QuestionCategory;
  target?: QuestionTarget;
  notes?: string;
  included?: boolean;
}

export interface InterviewPrepRepository {
  listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]>;
  findKnowledgeByHash(userId: string, contentHash: string): Promise<InterviewKnowledgeDoc | null>;
  createKnowledgeDoc(userId: string, input: KnowledgeDocInput): Promise<InterviewKnowledgeDoc>;
  updateKnowledgeDoc(
    userId: string,
    id: string,
    input: Partial<KnowledgeDocInput>
  ): Promise<InterviewKnowledgeDoc | null>;
  deleteKnowledgeDoc(userId: string, id: string): Promise<boolean>;

  replaceBankQuestionsForDoc(
    userId: string,
    knowledgeDocId: string,
    questions: Array<{ text: string; category: QuestionCategory; tags: string[]; contentHash: string }>
  ): Promise<void>;
  /** Insert questions that are not already present (by contentHash) for the document. */
  upsertBankQuestionsForDoc(
    userId: string,
    knowledgeDocId: string,
    questions: Array<{ text: string; category: QuestionCategory; tags: string[]; contentHash: string }>
  ): Promise<number>;
  listBankQuestions(
    userId: string,
    filter?: { q?: string; category?: string; tag?: string }
  ): Promise<InterviewBankQuestionRecord[]>;
  getBankQuestionsByIds(userId: string, ids: string[]): Promise<InterviewBankQuestionRecord[]>;

  listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]>;
  searchCaseEntries(
    userId: string,
    filter?: { q?: string; sourceKind?: string; style?: string; approvalStatus?: string }
  ): Promise<InterviewCaseEntryRecord[]>;
  findCaseByHash(userId: string, contentHash: string): Promise<InterviewCaseEntryRecord | null>;
  createCaseEntry(userId: string, input: CaseEntryInput): Promise<InterviewCaseEntryRecord>;
  updateCaseEntry(
    userId: string,
    id: string,
    input: Partial<CaseEntryInput>
  ): Promise<InterviewCaseEntryRecord | null>;
  deleteCaseEntry(userId: string, id: string): Promise<boolean>;
  approveCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null>;
  rejectCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null>;

  listPrepPlans(userId: string): Promise<InterviewPrepPlanRecord[]>;
  getPrepPlan(userId: string, id: string): Promise<InterviewPrepPlanRecord | null>;
  createPrepPlan(userId: string, input: PrepPlanCreateInput): Promise<InterviewPrepPlanRecord>;
  updatePrepPlanStatus(
    userId: string,
    id: string,
    status: PrepPlanStatus,
    failureReason?: string
  ): Promise<InterviewPrepPlanRecord | null>;
  setPrepPlanPipeline(
    userId: string,
    id: string,
    input: {
      pipelineStep: PrepPlanPipelineStep;
      researchNotes?: string;
      companyProfileJson?: string;
    }
  ): Promise<InterviewPrepPlanRecord | null>;
  setPrepPlanResearch(
    userId: string,
    id: string,
    input: {
      researchNotes: string;
      clarifications: Array<{ question: string; sortOrder: number }>;
      companyProfileJson?: string;
      clarificationRound?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null>;
  appendClarificationRound(
    userId: string,
    planId: string,
    clarifications: Array<{ question: string; sortOrder: number }>,
    round: number
  ): Promise<InterviewPrepPlanRecord | null>;
  saveClarificationAnswers(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>
  ): Promise<InterviewPrepPlanRecord | null>;
  setPrepPlanCurated(
    userId: string,
    id: string,
    input: {
      questions: Array<{
        text: string;
        category: QuestionCategory;
        target: QuestionTarget;
        source?: PrepQuestionSource;
        bankQuestionId?: string;
        storyId?: string;
        gapReason?: string;
      }>;
      tasks: Array<{ title: string; description: string }>;
      recommendedCaseIds?: string[];
    }
  ): Promise<InterviewPrepPlanRecord | null>;
  replacePlanQuestion(
    userId: string,
    planId: string,
    questionId: string,
    replacement: {
      text: string;
      category: QuestionCategory;
      target: QuestionTarget;
      source: PrepQuestionSource;
      bankQuestionId?: string;
      storyId?: string;
    }
  ): Promise<InterviewPrepPlanRecord | null>;
  patchPlanQuestion(
    userId: string,
    planId: string,
    questionId: string,
    patch: PlanQuestionPatchInput
  ): Promise<InterviewPrepPlanRecord | null>;
  addPlanQuestion(
    userId: string,
    planId: string,
    input: PlanQuestionCreateInput
  ): Promise<InterviewPrepPlanRecord | null>;
  deletePlanQuestion(
    userId: string,
    planId: string,
    questionId: string
  ): Promise<InterviewPrepPlanRecord | null>;
  reorderPlanQuestions(
    userId: string,
    planId: string,
    orderedIds: string[]
  ): Promise<InterviewPrepPlanRecord | null>;
  setPlanQuestionStory(
    userId: string,
    planId: string,
    questionId: string,
    storyId: string | null
  ): Promise<InterviewPrepPlanRecord | null>;

  getSimulatorSettings(userId: string, mode: InterviewMode): Promise<InterviewSimulatorSettingsRecord | null>;
  upsertSimulatorSettings(
    userId: string,
    input: InterviewSimulatorSettingsRecord
  ): Promise<InterviewSimulatorSettingsRecord>;

  listSessions(userId: string, mode?: InterviewMode): Promise<InterviewSessionRecord[]>;
  getSession(userId: string, id: string): Promise<InterviewSessionRecord | null>;
  createSession(
    userId: string,
    input: { mode: InterviewMode; title: string; prepPlanId?: string; caseEntryId?: string; systemPrompt: string }
  ): Promise<InterviewSessionRecord>;
  listSessionMessages(userId: string, sessionId: string): Promise<InterviewMessageRecord[]>;
  appendSessionMessage(
    userId: string,
    sessionId: string,
    role: InterviewMessageRecord["role"],
    content: string
  ): Promise<InterviewMessageRecord | null>;
  finishSession(
    userId: string,
    sessionId: string,
    feedback: InterviewFeedbackRubric
  ): Promise<InterviewSessionRecord | null>;

  listAbilityAttempts(userId: string, limit?: number): Promise<InterviewAbilityTestAttemptRecord[]>;
  createAbilityAttempt(userId: string, input: AbilityAttemptInput): Promise<InterviewAbilityTestAttemptRecord>;

  getVideoSettings(userId: string): Promise<InterviewVideoSettingsRecord | null>;
  upsertVideoSettings(userId: string, settings: VideoSimulatorSettings): Promise<InterviewVideoSettingsRecord>;
  listVideoRuns(userId: string, limit?: number): Promise<InterviewVideoRunRecord[]>;
  createVideoRun(userId: string, input: VideoRunInput): Promise<InterviewVideoRunRecord>;

  createImportJob(userId: string, input: ImportJobCreateInput): Promise<InterviewImportJobRecord>;
  getImportJob(userId: string, id: string): Promise<InterviewImportJobRecord | null>;
  listImportJobs(userId: string): Promise<InterviewImportJobRecord[]>;
  listImportJobsForDoc(
    userId: string,
    knowledgeDocId: string,
    kind?: ImportJobKind
  ): Promise<InterviewImportJobRecord[]>;
  updateImportJob(
    userId: string,
    id: string,
    input: ImportJobUpdateInput
  ): Promise<InterviewImportJobRecord | null>;
  /** Mark all queued/running import jobs as failed (process restart recovery). */
  failInterruptedImportJobs(message: string): Promise<number>;
  /** Mark researching/curating prep plans as failed (process restart recovery). */
  failInterruptedPrepPlans(message: string): Promise<number>;
}
