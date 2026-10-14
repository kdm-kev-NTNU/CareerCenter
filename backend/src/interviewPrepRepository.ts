import type {
  AbilityTestKind,
  CaseSourceKind,
  CaseStyle,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanStatus,
  QuestionCategory,
  QuestionTarget,
  StarRubricCriterion,
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
  createdAt: string;
  updatedAt: string;
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
  researchNotes: string;
  failureReason?: string;
  clarifications: InterviewPrepClarificationRecord[];
  questions: InterviewPrepQuestionRecord[];
  tasks: InterviewPrepTaskRecord[];
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

export interface InterviewStoryBankEntryRecord {
  id: string;
  userId: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryBankInput {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
}

export interface InterviewStoryScoreRecord {
  id: string;
  storyId: string;
  scores: Record<StarRubricCriterion, number>;
  sum: number;
  note: string;
  createdAt: string;
}

export interface InterviewCaseRepertoireLogRecord {
  id: string;
  userId: string;
  caseEntryId?: string;
  title: string;
  outcome: string;
  notes: string;
  practicedAt: string;
}

export interface RepertoireLogInput {
  caseEntryId?: string;
  title: string;
  outcome: string;
  notes: string;
  practicedAt?: string;
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
}

export interface PrepPlanCreateInput {
  companyName: string;
  roleTitle: string;
  format: PrepFormat;
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

  listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]>;
  findCaseByHash(userId: string, contentHash: string): Promise<InterviewCaseEntryRecord | null>;
  createCaseEntry(userId: string, input: CaseEntryInput): Promise<InterviewCaseEntryRecord>;
  updateCaseEntry(
    userId: string,
    id: string,
    input: Partial<CaseEntryInput>
  ): Promise<InterviewCaseEntryRecord | null>;
  deleteCaseEntry(userId: string, id: string): Promise<boolean>;

  listPrepPlans(userId: string): Promise<InterviewPrepPlanRecord[]>;
  getPrepPlan(userId: string, id: string): Promise<InterviewPrepPlanRecord | null>;
  createPrepPlan(userId: string, input: PrepPlanCreateInput): Promise<InterviewPrepPlanRecord>;
  updatePrepPlanStatus(
    userId: string,
    id: string,
    status: PrepPlanStatus,
    failureReason?: string
  ): Promise<InterviewPrepPlanRecord | null>;
  setPrepPlanResearch(
    userId: string,
    id: string,
    input: { researchNotes: string; clarifications: Array<{ question: string; sortOrder: number }> }
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
      questions: Array<{ text: string; category: QuestionCategory; target: QuestionTarget }>;
      tasks: Array<{ title: string; description: string }>;
    }
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
    input: { mode: InterviewMode; title: string; prepPlanId?: string; systemPrompt: string }
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

  listStoryBankEntries(userId: string): Promise<InterviewStoryBankEntryRecord[]>;
  getStoryBankEntry(userId: string, id: string): Promise<InterviewStoryBankEntryRecord | null>;
  createStoryBankEntry(userId: string, input: StoryBankInput): Promise<InterviewStoryBankEntryRecord>;
  updateStoryBankEntry(
    userId: string,
    id: string,
    input: Partial<StoryBankInput>
  ): Promise<InterviewStoryBankEntryRecord | null>;
  deleteStoryBankEntry(userId: string, id: string): Promise<boolean>;
  listStoryScores(userId: string, storyId: string): Promise<InterviewStoryScoreRecord[]>;
  addStoryScore(
    userId: string,
    storyId: string,
    input: { scores: Record<StarRubricCriterion, number>; sum: number; note: string }
  ): Promise<InterviewStoryScoreRecord | null>;

  listRepertoireLogs(userId: string): Promise<InterviewCaseRepertoireLogRecord[]>;
  createRepertoireLog(userId: string, input: RepertoireLogInput): Promise<InterviewCaseRepertoireLogRecord>;

  listAbilityAttempts(userId: string, limit?: number): Promise<InterviewAbilityTestAttemptRecord[]>;
  createAbilityAttempt(userId: string, input: AbilityAttemptInput): Promise<InterviewAbilityTestAttemptRecord>;

  getVideoSettings(userId: string): Promise<InterviewVideoSettingsRecord | null>;
  upsertVideoSettings(userId: string, settings: VideoSimulatorSettings): Promise<InterviewVideoSettingsRecord>;
  listVideoRuns(userId: string, limit?: number): Promise<InterviewVideoRunRecord[]>;
  createVideoRun(userId: string, input: VideoRunInput): Promise<InterviewVideoRunRecord>;
}
