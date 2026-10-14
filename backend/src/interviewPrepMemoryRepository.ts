import { nanoid } from "nanoid";
import type {
  AbilityAttemptInput,
  ImportJobCreateInput,
  ImportJobUpdateInput,
  InterviewAbilityTestAttemptRecord,
  InterviewBankQuestionRecord,
  InterviewCaseEntryRecord,
  InterviewCaseRepertoireLogRecord,
  InterviewImportJobRecord,
  InterviewKnowledgeDoc,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewPrepRepository,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord,
  InterviewStoryBankEntryRecord,
  InterviewStoryScoreRecord,
  InterviewVideoRunRecord,
  InterviewVideoSettingsRecord,
  CaseEntryInput,
  KnowledgeDocInput,
  PrepPlanCreateInput,
  RepertoireLogInput,
  StoryBankInput,
  VideoRunInput
} from "./interviewPrepRepository.js";
import type { InterviewFeedbackRubric } from "./interview/feedbackRubric.js";
import type {
  InterviewMode,
  PrepPlanStatus,
  QuestionCategory,
  QuestionTarget,
  VideoSimulatorSettings
} from "@careercenter/shared";

function nowIso(): string {
  return new Date().toISOString();
}

function includesCi(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export class InterviewPrepMemoryRepository implements InterviewPrepRepository {
  private readonly knowledgeDocs = new Map<string, InterviewKnowledgeDoc>();
  private readonly bankQuestions = new Map<string, InterviewBankQuestionRecord>();
  private readonly caseEntries = new Map<string, InterviewCaseEntryRecord>();
  private readonly prepPlans = new Map<string, InterviewPrepPlanRecord>();
  private readonly importJobs = new Map<string, InterviewImportJobRecord>();
  private readonly simulatorSettings = new Map<string, InterviewSimulatorSettingsRecord>();
  private readonly sessions = new Map<string, InterviewSessionRecord>();
  private readonly messages = new Map<string, InterviewMessageRecord>();
  private readonly stories = new Map<string, InterviewStoryBankEntryRecord>();
  private readonly storyScores = new Map<string, InterviewStoryScoreRecord>();
  private readonly repertoireLogs = new Map<string, InterviewCaseRepertoireLogRecord>();
  private readonly abilityAttempts = new Map<string, InterviewAbilityTestAttemptRecord>();
  private readonly videoSettings = new Map<string, InterviewVideoSettingsRecord>();
  private readonly videoRuns = new Map<string, InterviewVideoRunRecord>();

  async listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]> {
    return [...this.knowledgeDocs.values()]
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }

  async findKnowledgeByHash(userId: string, contentHash: string): Promise<InterviewKnowledgeDoc | null> {
    return (
      [...this.knowledgeDocs.values()].find((doc) => doc.userId === userId && doc.contentHash === contentHash) ??
      null
    );
  }

  async createKnowledgeDoc(userId: string, input: KnowledgeDocInput): Promise<InterviewKnowledgeDoc> {
    const timestamp = nowIso();
    const doc: InterviewKnowledgeDoc = {
      id: nanoid(),
      userId,
      kind: input.kind ?? "other",
      title: input.title,
      content: input.content,
      sourceFilename: input.sourceFilename,
      originalFileKey: input.originalFileKey,
      contentHash: input.contentHash,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.knowledgeDocs.set(doc.id, doc);
    return doc;
  }

  async updateKnowledgeDoc(
    userId: string,
    id: string,
    input: Partial<KnowledgeDocInput>
  ): Promise<InterviewKnowledgeDoc | null> {
    const existing = this.knowledgeDocs.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: InterviewKnowledgeDoc = {
      ...existing,
      ...input,
      kind: input.kind ?? existing.kind,
      updatedAt: nowIso()
    };
    this.knowledgeDocs.set(id, updated);
    return updated;
  }

  async deleteKnowledgeDoc(userId: string, id: string): Promise<boolean> {
    const existing = this.knowledgeDocs.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.knowledgeDocs.delete(id);
    for (const [questionId, question] of this.bankQuestions) {
      if (question.knowledgeDocId === id) this.bankQuestions.delete(questionId);
    }
    for (const [jobId, job] of this.importJobs) {
      if (job.knowledgeDocId === id) this.importJobs.delete(jobId);
    }
    return true;
  }

  async replaceBankQuestionsForDoc(
    userId: string,
    knowledgeDocId: string,
    questions: Array<{ text: string; category: QuestionCategory; tags: string[]; contentHash: string }>
  ): Promise<void> {
    for (const [questionId, question] of this.bankQuestions) {
      if (question.userId === userId && question.knowledgeDocId === knowledgeDocId) {
        this.bankQuestions.delete(questionId);
      }
    }
    const timestamp = nowIso();
    for (const item of questions) {
      const row: InterviewBankQuestionRecord = {
        id: nanoid(),
        userId,
        knowledgeDocId,
        text: item.text,
        category: item.category,
        tags: item.tags,
        contentHash: item.contentHash,
        createdAt: timestamp
      };
      this.bankQuestions.set(row.id, row);
    }
  }

  async listBankQuestions(
    userId: string,
    filter?: { q?: string; category?: string; tag?: string }
  ): Promise<InterviewBankQuestionRecord[]> {
    return [...this.bankQuestions.values()]
      .filter((row) => {
        if (row.userId !== userId) return false;
        if (filter?.category && row.category !== filter.category) return false;
        if (filter?.tag && !row.tags.some((tag) => tag === filter.tag)) return false;
        if (filter?.q && !includesCi(row.text, filter.q)) return false;
        return true;
      })
      .sort((a, b) => a.text.localeCompare(b.text, "nb"));
  }

  async getBankQuestionsByIds(userId: string, ids: string[]): Promise<InterviewBankQuestionRecord[]> {
    const idSet = new Set(ids);
    return [...this.bankQuestions.values()].filter((row) => row.userId === userId && idSet.has(row.id));
  }

  async listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]> {
    return [...this.caseEntries.values()]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }

  async searchCaseEntries(
    userId: string,
    filter?: { q?: string; sourceKind?: string; style?: string; approvalStatus?: string }
  ): Promise<InterviewCaseEntryRecord[]> {
    return [...this.caseEntries.values()]
      .filter((entry) => {
        if (entry.userId !== userId) return false;
        if (filter?.sourceKind && entry.sourceKind !== filter.sourceKind) return false;
        if (filter?.style && entry.caseStyle !== filter.style) return false;
        if (filter?.approvalStatus && entry.approvalStatus !== filter.approvalStatus) return false;
        if (filter?.q) {
          const q = filter.q;
          const matches =
            includesCi(entry.title, q) ||
            includesCi(entry.prompt, q) ||
            includesCi(entry.interviewerInfo, q) ||
            includesCi(entry.solution, q);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }

  async findCaseByHash(userId: string, contentHash: string): Promise<InterviewCaseEntryRecord | null> {
    return (
      [...this.caseEntries.values()].find((entry) => entry.userId === userId && entry.contentHash === contentHash) ??
      null
    );
  }

  async createCaseEntry(userId: string, input: CaseEntryInput): Promise<InterviewCaseEntryRecord> {
    const timestamp = nowIso();
    const entry: InterviewCaseEntryRecord = {
      id: nanoid(),
      userId,
      knowledgeDocId: input.knowledgeDocId,
      title: input.title,
      prompt: input.prompt,
      interviewerInfo: input.interviewerInfo,
      solution: input.solution,
      sourceKind: input.sourceKind,
      caseStyle: input.caseStyle,
      companyTags: input.companyTags,
      contentHash: input.contentHash,
      approvalStatus: input.approvalStatus ?? "approved",
      originalFileKey: input.originalFileKey,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.caseEntries.set(entry.id, entry);
    return entry;
  }

  async updateCaseEntry(
    userId: string,
    id: string,
    input: Partial<CaseEntryInput>
  ): Promise<InterviewCaseEntryRecord | null> {
    const existing = this.caseEntries.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated = { ...existing, ...input, updatedAt: nowIso() };
    this.caseEntries.set(id, updated);
    return updated;
  }

  async deleteCaseEntry(userId: string, id: string): Promise<boolean> {
    const existing = this.caseEntries.get(id);
    if (!existing || existing.userId !== userId) return false;
    this.caseEntries.delete(id);
    return true;
  }

  async approveCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null> {
    return this.updateCaseEntry(userId, id, { approvalStatus: "approved" });
  }

  async rejectCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null> {
    return this.updateCaseEntry(userId, id, { approvalStatus: "rejected" });
  }

  async listPrepPlans(userId: string): Promise<InterviewPrepPlanRecord[]> {
    return [...this.prepPlans.values()]
      .filter((plan) => plan.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getPrepPlan(userId: string, id: string): Promise<InterviewPrepPlanRecord | null> {
    const plan = this.prepPlans.get(id);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  }

  async createPrepPlan(userId: string, input: PrepPlanCreateInput): Promise<InterviewPrepPlanRecord> {
    const timestamp = nowIso();
    const plan: InterviewPrepPlanRecord = {
      id: nanoid(),
      userId,
      companyName: input.companyName,
      roleTitle: input.roleTitle,
      format: input.format,
      status: "draft",
      researchNotes: "",
      companyProfileJson: "{}",
      clarificationRound: 0,
      clarifications: [],
      questions: [],
      tasks: [],
      recommendedCases: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.prepPlans.set(plan.id, plan);
    return plan;
  }

  async updatePrepPlanStatus(
    userId: string,
    id: string,
    status: PrepPlanStatus,
    failureReason?: string
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, id);
    if (!plan) return null;
    const updated = { ...plan, status, failureReason, updatedAt: nowIso() };
    this.prepPlans.set(id, updated);
    return updated;
  }

  async setPrepPlanResearch(
    userId: string,
    id: string,
    input: {
      researchNotes: string;
      clarifications: Array<{ question: string; sortOrder: number }>;
      companyProfileJson?: string;
      clarificationRound?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, id);
    if (!plan) return null;
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      researchNotes: input.researchNotes,
      companyProfileJson: input.companyProfileJson ?? plan.companyProfileJson,
      clarificationRound: input.clarificationRound ?? 1,
      clarifications: input.clarifications.map((item) => ({
        id: nanoid(),
        question: item.question,
        answer: "",
        sortOrder: item.sortOrder
      })),
      updatedAt: nowIso()
    };
    this.prepPlans.set(id, updated);
    return updated;
  }

  async appendClarificationRound(
    userId: string,
    planId: string,
    clarifications: Array<{ question: string; sortOrder: number }>,
    round: number
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const appended = clarifications.map((item) => ({
      id: nanoid(),
      question: item.question,
      answer: "",
      sortOrder: item.sortOrder
    }));
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      clarificationRound: round,
      clarifications: [...plan.clarifications, ...appended],
      updatedAt: nowIso()
    };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async saveClarificationAnswers(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const answerMap = new Map(answers.map((item) => [item.id, item.answer]));
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      clarifications: plan.clarifications.map((item) => ({
        ...item,
        answer: answerMap.get(item.id) ?? item.answer
      })),
      updatedAt: nowIso()
    };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  private buildRecommendedCases(caseIds: string[]): InterviewPrepPlanRecord["recommendedCases"] {
    return caseIds
      .map((caseEntryId, index) => {
        const entry = this.caseEntries.get(caseEntryId);
        if (!entry) return null;
        return {
          id: nanoid(),
          caseEntryId,
          title: entry.title,
          prompt: entry.prompt,
          sourceKind: entry.sourceKind,
          sortOrder: index
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async setPrepPlanCurated(
    userId: string,
    id: string,
    input: {
      questions: Array<{
        text: string;
        category: QuestionCategory;
        target: QuestionTarget;
        source: "bank" | "generated";
        bankQuestionId?: string;
        storyId?: string;
        gapReason?: string;
      }>;
      tasks: Array<{ title: string; description: string }>;
      recommendedCaseIds?: string[];
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, id);
    if (!plan) return null;
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      questions: input.questions.map((item, index) => ({
        id: nanoid(),
        text: item.text,
        category: item.category,
        target: item.target,
        sortOrder: index,
        source: item.source ?? "generated",
        bankQuestionId: item.bankQuestionId,
        storyId: item.storyId,
        gapReason: item.gapReason
      })),
      tasks: input.tasks.map((item, index) => ({
        id: nanoid(),
        title: item.title,
        description: item.description,
        sortOrder: index,
        done: false
      })),
      recommendedCases: this.buildRecommendedCases(input.recommendedCaseIds ?? []),
      updatedAt: nowIso()
    };
    this.prepPlans.set(id, updated);
    return updated;
  }

  async replacePlanQuestion(
    userId: string,
    planId: string,
    questionId: string,
    replacement: {
      text: string;
      category: QuestionCategory;
      target: QuestionTarget;
      source: "bank" | "generated";
      bankQuestionId?: string;
      storyId?: string;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const index = plan.questions.findIndex((q) => q.id === questionId);
    if (index < 0) return null;
    const existing = plan.questions[index]!;
    const questions = [...plan.questions];
    questions[index] = {
      id: existing.id,
      text: replacement.text,
      category: replacement.category,
      target: replacement.target,
      sortOrder: existing.sortOrder,
      source: replacement.source,
      bankQuestionId: replacement.bankQuestionId,
      storyId: replacement.storyId,
      gapReason: undefined
    };
    const updated = { ...plan, questions, updatedAt: nowIso() };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async setPlanQuestionStory(
    userId: string,
    planId: string,
    questionId: string,
    storyId: string | null
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const questions = plan.questions.map((q) =>
      q.id === questionId ? { ...q, storyId: storyId ?? undefined } : q
    );
    const updated = { ...plan, questions, updatedAt: nowIso() };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  private settingsKey(userId: string, mode: InterviewMode): string {
    return `${userId}:${mode}`;
  }

  async getSimulatorSettings(userId: string, mode: InterviewMode): Promise<InterviewSimulatorSettingsRecord | null> {
    return this.simulatorSettings.get(this.settingsKey(userId, mode)) ?? null;
  }

  async upsertSimulatorSettings(
    userId: string,
    input: InterviewSimulatorSettingsRecord
  ): Promise<InterviewSimulatorSettingsRecord> {
    const record = { ...input, userId };
    this.simulatorSettings.set(this.settingsKey(userId, input.mode), record);
    return record;
  }

  async listSessions(userId: string, mode?: InterviewMode): Promise<InterviewSessionRecord[]> {
    return [...this.sessions.values()]
      .filter((session) => session.userId === userId && (!mode || session.mode === mode))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSession(userId: string, id: string): Promise<InterviewSessionRecord | null> {
    const session = this.sessions.get(id);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  async createSession(
    userId: string,
    input: { mode: InterviewMode; title: string; prepPlanId?: string; caseEntryId?: string; systemPrompt: string }
  ): Promise<InterviewSessionRecord> {
    const timestamp = nowIso();
    const session: InterviewSessionRecord = {
      id: nanoid(),
      userId,
      mode: input.mode,
      title: input.title,
      prepPlanId: input.prepPlanId,
      caseEntryId: input.caseEntryId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.sessions.set(session.id, session);
    await this.appendSessionMessage(userId, session.id, "system", input.systemPrompt);
    return session;
  }

  async listSessionMessages(userId: string, sessionId: string): Promise<InterviewMessageRecord[]> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return [];
    return [...this.messages.values()]
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async appendSessionMessage(
    userId: string,
    sessionId: string,
    role: InterviewMessageRecord["role"],
    content: string
  ): Promise<InterviewMessageRecord | null> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return null;
    const message: InterviewMessageRecord = {
      id: nanoid(),
      sessionId,
      role,
      content,
      createdAt: nowIso()
    };
    this.messages.set(message.id, message);
    session.updatedAt = nowIso();
    this.sessions.set(sessionId, session);
    return message;
  }

  async finishSession(
    userId: string,
    sessionId: string,
    feedback: InterviewFeedbackRubric
  ): Promise<InterviewSessionRecord | null> {
    const session = await this.getSession(userId, sessionId);
    if (!session || session.finishedAt) return null;
    const updated: InterviewSessionRecord = {
      ...session,
      feedback,
      finishedAt: nowIso(),
      updatedAt: nowIso()
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async listStoryBankEntries(userId: string): Promise<InterviewStoryBankEntryRecord[]> {
    return [...this.stories.values()]
      .filter((story) => story.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getStoryBankEntry(userId: string, id: string): Promise<InterviewStoryBankEntryRecord | null> {
    const story = this.stories.get(id);
    if (!story || story.userId !== userId) return null;
    return story;
  }

  async createStoryBankEntry(userId: string, input: StoryBankInput): Promise<InterviewStoryBankEntryRecord> {
    const timestamp = nowIso();
    const story: InterviewStoryBankEntryRecord = {
      id: nanoid(),
      userId,
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.stories.set(story.id, story);
    return story;
  }

  async updateStoryBankEntry(
    userId: string,
    id: string,
    input: Partial<StoryBankInput>
  ): Promise<InterviewStoryBankEntryRecord | null> {
    const existing = await this.getStoryBankEntry(userId, id);
    if (!existing) return null;
    const updated = { ...existing, ...input, updatedAt: nowIso() };
    this.stories.set(id, updated);
    return updated;
  }

  async deleteStoryBankEntry(userId: string, id: string): Promise<boolean> {
    const existing = await this.getStoryBankEntry(userId, id);
    if (!existing) return false;
    this.stories.delete(id);
    for (const [scoreId, score] of this.storyScores) {
      if (score.storyId === id) this.storyScores.delete(scoreId);
    }
    return true;
  }

  async listStoryScores(userId: string, storyId: string): Promise<InterviewStoryScoreRecord[]> {
    const story = await this.getStoryBankEntry(userId, storyId);
    if (!story) return [];
    return [...this.storyScores.values()]
      .filter((score) => score.storyId === storyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addStoryScore(
    userId: string,
    storyId: string,
    input: { scores: InterviewStoryScoreRecord["scores"]; sum: number; note: string }
  ): Promise<InterviewStoryScoreRecord | null> {
    const story = await this.getStoryBankEntry(userId, storyId);
    if (!story) return null;
    const score: InterviewStoryScoreRecord = {
      id: nanoid(),
      storyId,
      scores: input.scores,
      sum: input.sum,
      note: input.note,
      createdAt: nowIso()
    };
    this.storyScores.set(score.id, score);
    story.updatedAt = nowIso();
    this.stories.set(storyId, story);
    return score;
  }

  async listRepertoireLogs(userId: string): Promise<InterviewCaseRepertoireLogRecord[]> {
    return [...this.repertoireLogs.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.practicedAt.localeCompare(a.practicedAt));
  }

  async createRepertoireLog(userId: string, input: RepertoireLogInput): Promise<InterviewCaseRepertoireLogRecord> {
    const row: InterviewCaseRepertoireLogRecord = {
      id: nanoid(),
      userId,
      caseEntryId: input.caseEntryId,
      title: input.title,
      company: input.company ?? "",
      format: input.format ?? "",
      tested: input.tested ?? "",
      improvement: input.improvement ?? "",
      outcome: input.outcome,
      notes: input.notes,
      practicedAt: input.practicedAt ?? nowIso()
    };
    this.repertoireLogs.set(row.id, row);
    return row;
  }

  async listAbilityAttempts(userId: string, limit = 50): Promise<InterviewAbilityTestAttemptRecord[]> {
    return [...this.abilityAttempts.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createAbilityAttempt(userId: string, input: AbilityAttemptInput): Promise<InterviewAbilityTestAttemptRecord> {
    const row: InterviewAbilityTestAttemptRecord = {
      id: nanoid(),
      userId,
      ...input,
      createdAt: nowIso()
    };
    this.abilityAttempts.set(row.id, row);
    return row;
  }

  async getVideoSettings(userId: string): Promise<InterviewVideoSettingsRecord | null> {
    return this.videoSettings.get(userId) ?? null;
  }

  async upsertVideoSettings(userId: string, settings: VideoSimulatorSettings): Promise<InterviewVideoSettingsRecord> {
    const row: InterviewVideoSettingsRecord = {
      userId,
      thinkSeconds: settings.thinkSeconds,
      answerSeconds: settings.answerSeconds,
      promptsJson: JSON.stringify(settings.prompts),
      updatedAt: nowIso()
    };
    this.videoSettings.set(userId, row);
    return row;
  }

  async listVideoRuns(userId: string, limit = 20): Promise<InterviewVideoRunRecord[]> {
    return [...this.videoRuns.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createVideoRun(userId: string, input: VideoRunInput): Promise<InterviewVideoRunRecord> {
    const timestamp = nowIso();
    const row: InterviewVideoRunRecord = {
      id: nanoid(),
      userId,
      settingsJson: JSON.stringify(input.settings),
      state: input.state,
      cardIndex: input.cardIndex,
      blobKey: input.blobKey,
      transcript: input.transcript,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.videoRuns.set(row.id, row);
    return row;
  }

  async createImportJob(userId: string, input: ImportJobCreateInput): Promise<InterviewImportJobRecord> {
    const timestamp = nowIso();
    const row: InterviewImportJobRecord = {
      id: nanoid(),
      userId,
      knowledgeDocId: input.knowledgeDocId,
      status: "queued",
      progress: 0,
      message: "",
      resultJson: "[]",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.importJobs.set(row.id, row);
    return row;
  }

  async getImportJob(userId: string, id: string): Promise<InterviewImportJobRecord | null> {
    const row = this.importJobs.get(id);
    if (!row || row.userId !== userId) return null;
    return row;
  }

  async listImportJobs(userId: string): Promise<InterviewImportJobRecord[]> {
    return [...this.importJobs.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async updateImportJob(
    userId: string,
    id: string,
    input: ImportJobUpdateInput
  ): Promise<InterviewImportJobRecord | null> {
    const existing = await this.getImportJob(userId, id);
    if (!existing) return null;
    const updated: InterviewImportJobRecord = {
      ...existing,
      ...input,
      updatedAt: nowIso()
    };
    this.importJobs.set(id, updated);
    return updated;
  }
}
