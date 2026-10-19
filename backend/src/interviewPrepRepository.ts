import type {
  AbilityTestKind,
  PlanSectionKey,
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
  PrepPlanPipelineStep,
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionAudience,
  QuestionCategory,
  QuestionDiscardReason,
  QuestionTarget,
  ResearchModel,
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
  audience: QuestionAudience;
  status: BankQuestionStatus;
  discardReason?: QuestionDiscardReason;
  origin: BankQuestionOrigin;
  /** Text as first extracted from the document; identity for reindex and dedupe. */
  sourceText: string;
  tags: string[];
  contentHash: string;
  cleanedAt?: string;
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
  audience: QuestionAudience;
  target: QuestionTarget;
  sortOrder: number;
  source: PrepQuestionSource;
  bankQuestionId?: string;
  storyId?: string;
  gapReason?: string;
  included: boolean;
  notes: string;
  exampleAnswer: string;
  tips: string[];
}

export interface InterviewPrepPlanRecord {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
  researchModel: ResearchModel;
  status: PrepPlanStatus;
  pipelineStep: PrepPlanPipelineStep;
  jobAdText: string;
  researchNotes: string;
  searchSnippet: string;
  companyProfileJson: string;
  clarificationRound: number;
  curationFilledCount: number;
  failureReason?: string;
  clarifications: InterviewPrepClarificationRecord[];
  questions: InterviewPrepQuestionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateBackgroundRecord {
  userId: string;
  cvText: string;
  cvFileName: string;
  cvUpdatedAt: string | null;
  transcriptText: string;
  transcriptFileName: string;
  transcriptUpdatedAt: string | null;
  notes: string;
  updatedAt: string | null;
}

export interface CandidateBackgroundNotesInput {
  notes: string;
}

export interface CandidateBackgroundDocumentInput {
  kind: "cv" | "transcript";
  text: string;
  fileName: string;
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
  /** `null` = use the shared default for the mode. */
  essentialsSheet: string | null;
}

export interface InterviewSessionRecord {
  id: string;
  userId: string;
  mode: InterviewMode;
  title: string;
  prepPlanId?: string;
  planSection?: PlanSectionKey;
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
  questionCount: number;
  ratingModel: string;
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
  prompt: string;
  companyName: string;
  roleDescription: string;
  feedback?: InterviewFeedbackRubric;
  createdAt: string;
  updatedAt: string;
}

export interface VideoRunInput {
  state: VideoSimState;
  cardIndex?: number;
  blobKey?: string;
  transcript: string;
  prompt?: string;
  companyName?: string;
  roleDescription?: string;
  feedback?: InterviewFeedbackRubric;
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
  researchModel: ResearchModel;
  jobAdText?: string;
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

export interface BankQuestionInput {
  text: string;
  category: QuestionCategory;
  audience?: QuestionAudience;
  tags: string[];
  contentHash: string;
  origin: BankQuestionOrigin;
  /** Defaults to `text`. */
  sourceText?: string;
  cleanedAt?: string;
}

export interface BankQuestionFilter {
  q?: string;
  category?: string;
  tag?: string;
  audience?: QuestionAudience;
  /** Defaults to `active`. */
  status?: BankQuestionStatus | "all";
  knowledgeDocId?: string;
  /** Only questions the cleanup agent has not reviewed yet. */
  uncleaned?: boolean;
}

export interface BankQuestionPatch {
  text?: string;
  category?: QuestionCategory;
  audience?: QuestionAudience;
  status?: BankQuestionStatus;
  discardReason?: QuestionDiscardReason | null;
  origin?: BankQuestionOrigin;
  cleanedAt?: string | null;
}

export interface BankQuestionSummary {
  byAudience: Record<QuestionAudience, number>;
  discarded: number;
  uncleaned: number;
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
  audience?: QuestionAudience;
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

  /** Insert questions; rows whose (userId, contentHash) already exists are skipped. Returns inserted count. */
  insertBankQuestions(userId: string, knowledgeDocId: string, questions: BankQuestionInput[]): Promise<number>;
  listBankQuestions(userId: string, filter?: BankQuestionFilter): Promise<InterviewBankQuestionRecord[]>;
  getBankQuestionsByIds(userId: string, ids: string[]): Promise<InterviewBankQuestionRecord[]>;
  updateBankQuestion(
    userId: string,
    id: string,
    patch: BankQuestionPatch
  ): Promise<InterviewBankQuestionRecord | null>;
  deleteBankQuestions(userId: string, ids: string[]): Promise<number>;
  /** Mark active, non-manual questions as not cleaned so the cleanup agent reviews them again. */
  resetBankQuestionCleanup(userId: string): Promise<number>;
  summarizeBankQuestions(userId: string): Promise<BankQuestionSummary>;

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
  /**
   * Removes a plan with its questions and clarifications.
   * Sessions practised with the plan are kept but lose the link to it.
   * Returns false when the plan is missing or research/curation is in progress.
   */
  deletePrepPlan(userId: string, id: string): Promise<boolean>;
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
      searchSnippet?: string;
      companyProfileJson?: string;
      curationFilledCount?: number;
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
        audience?: QuestionAudience;
        target: QuestionTarget;
        source?: PrepQuestionSource;
        bankQuestionId?: string;
        storyId?: string;
        gapReason?: string;
        notes?: string;
      }>;
      curationFilledCount?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null>;
  setPrepPlanAnswerDrafts(
    userId: string,
    planId: string,
    drafts: Array<{ questionAlias: string; exampleAnswer: string; tips: string[] }>
  ): Promise<InterviewPrepPlanRecord | null>;
  getCandidateBackground(userId: string): Promise<CandidateBackgroundRecord | null>;
  upsertCandidateBackgroundNotes(
    userId: string,
    input: CandidateBackgroundNotesInput
  ): Promise<CandidateBackgroundRecord>;
  upsertCandidateBackgroundDocument(
    userId: string,
    input: CandidateBackgroundDocumentInput
  ): Promise<CandidateBackgroundRecord>;
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
    input: {
      mode: InterviewMode;
      title: string;
      prepPlanId?: string;
      planSection?: PlanSectionKey;
      caseEntryId?: string;
      systemPrompt: string;
    }
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
  /** Deletes a finished session with its messages; false when missing or still running. */
  deleteFinishedSession(userId: string, sessionId: string): Promise<boolean>;

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
  /**
   * Removes a stopped or finished import job.
   * Returns false when the job is missing or still queued/running.
   * Does not delete the knowledge document or extracted cases.
   */
  deleteImportJob(userId: string, id: string): Promise<boolean>;
  /** Mark all queued/running import jobs as failed (process restart recovery). */
  failInterruptedImportJobs(message: string): Promise<number>;
  /** Mark researching/curating prep plans as failed (process restart recovery). */
  failInterruptedPrepPlans(message: string): Promise<number>;
}
