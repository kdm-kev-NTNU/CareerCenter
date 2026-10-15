import { nanoid } from "nanoid";
import type {
  AbilityAttemptInput,
  BankQuestionFilter,
  BankQuestionInput,
  BankQuestionPatch,
  BankQuestionSummary,
  ImportJobCreateInput,
  ImportJobUpdateInput,
  InterviewAbilityTestAttemptRecord,
  InterviewBankQuestionRecord,
  InterviewCaseEntryRecord,
  InterviewImportJobRecord,
  InterviewKnowledgeDoc,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewPrepRepository,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord,
  InterviewVideoRunRecord,
  InterviewVideoSettingsRecord,
  CaseEntryInput,
  KnowledgeDocInput,
  PlanQuestionCreateInput,
  PlanQuestionPatchInput,
  PrepPlanCreateInput,
  VideoRunInput
} from "./interviewPrepRepository.js";
import type { InterviewFeedbackRubric } from "./interview/feedbackRubric.js";
import { canDeleteImportJob, categoryForAudience } from "@careercenter/shared";
import type {
  ImportJobKind,
  InterviewMode,
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionAudience,
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

  async insertBankQuestions(
    userId: string,
    knowledgeDocId: string,
    questions: BankQuestionInput[]
  ): Promise<number> {
    // Mirrors the (userId, contentHash) unique index with skipDuplicates.
    const existingHashes = new Set(
      [...this.bankQuestions.values()].filter((q) => q.userId === userId).map((q) => q.contentHash)
    );
    const timestamp = nowIso();
    let inserted = 0;
    for (const item of questions) {
      if (existingHashes.has(item.contentHash)) continue;
      existingHashes.add(item.contentHash);
      const row: InterviewBankQuestionRecord = {
        id: nanoid(),
        userId,
        knowledgeDocId,
        text: item.text,
        category: item.category,
        audience: item.audience ?? "candidate",
        status: "active",
        origin: item.origin,
        sourceText: item.sourceText ?? item.text,
        tags: item.tags,
        contentHash: item.contentHash,
        cleanedAt: item.cleanedAt,
        createdAt: timestamp
      };
      this.bankQuestions.set(row.id, row);
      inserted += 1;
    }
    return inserted;
  }

  async listBankQuestions(userId: string, filter?: BankQuestionFilter): Promise<InterviewBankQuestionRecord[]> {
    const status = filter?.status ?? "active";
    return [...this.bankQuestions.values()]
      .filter((row) => {
        if (row.userId !== userId) return false;
        if (status !== "all" && row.status !== status) return false;
        if (filter?.audience && row.audience !== filter.audience) return false;
        if (filter?.knowledgeDocId && row.knowledgeDocId !== filter.knowledgeDocId) return false;
        if (filter?.uncleaned && row.cleanedAt) return false;
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

  async updateBankQuestion(
    userId: string,
    id: string,
    patch: BankQuestionPatch
  ): Promise<InterviewBankQuestionRecord | null> {
    const existing = this.bankQuestions.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: InterviewBankQuestionRecord = {
      ...existing,
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.discardReason !== undefined ? { discardReason: patch.discardReason ?? undefined } : {}),
      ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
      ...(patch.cleanedAt !== undefined ? { cleanedAt: patch.cleanedAt ?? undefined } : {})
    };
    this.bankQuestions.set(id, updated);
    return updated;
  }

  async deleteBankQuestions(userId: string, ids: string[]): Promise<number> {
    let removed = 0;
    for (const id of ids) {
      const row = this.bankQuestions.get(id);
      if (!row || row.userId !== userId) continue;
      this.bankQuestions.delete(id);
      removed += 1;
    }
    return removed;
  }

  async resetBankQuestionCleanup(userId: string): Promise<number> {
    let reset = 0;
    for (const [id, row] of this.bankQuestions) {
      if (row.userId !== userId || row.status !== "active" || row.origin === "manual") continue;
      this.bankQuestions.set(id, { ...row, cleanedAt: undefined });
      reset += 1;
    }
    return reset;
  }

  async summarizeBankQuestions(userId: string): Promise<BankQuestionSummary> {
    const summary: BankQuestionSummary = {
      byAudience: { candidate: 0, ask_interviewer_personal: 0, ask_interviewer_company: 0 },
      discarded: 0,
      uncleaned: 0
    };
    for (const row of this.bankQuestions.values()) {
      if (row.userId !== userId) continue;
      if (row.status === "discarded") {
        summary.discarded += 1;
        continue;
      }
      summary.byAudience[row.audience] += 1;
      if (!row.cleanedAt) summary.uncleaned += 1;
    }
    return summary;
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
      researchModel: input.researchModel,
      status: "draft",
      pipelineStep: "created",
      jobAdText: input.jobAdText ?? "",
      researchNotes: "",
      companyProfileJson: "{}",
      companyReportJson: "",
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

  async setPrepPlanPipeline(
    userId: string,
    id: string,
    input: {
      pipelineStep: InterviewPrepPlanRecord["pipelineStep"];
      researchNotes?: string;
      companyProfileJson?: string;
      companyReportJson?: string;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, id);
    if (!plan) return null;
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      pipelineStep: input.pipelineStep,
      researchNotes: input.researchNotes ?? plan.researchNotes,
      companyProfileJson: input.companyProfileJson ?? plan.companyProfileJson,
      companyReportJson: input.companyReportJson ?? plan.companyReportJson,
      updatedAt: nowIso()
    };
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
      companyReportJson?: string;
      clarificationRound?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, id);
    if (!plan) return null;
    const updated: InterviewPrepPlanRecord = {
      ...plan,
      researchNotes: input.researchNotes,
      companyProfileJson: input.companyProfileJson ?? plan.companyProfileJson,
      companyReportJson: input.companyReportJson ?? plan.companyReportJson,
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
        audience?: QuestionAudience;
        target: QuestionTarget;
        source?: PrepQuestionSource;
        bankQuestionId?: string;
        storyId?: string;
        gapReason?: string;
        notes?: string;
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
        category: categoryForAudience(item.audience ?? "candidate", item.category),
        audience: item.audience ?? "candidate",
        target: item.target,
        sortOrder: index,
        source: item.source ?? "generated",
        bankQuestionId: item.bankQuestionId,
        storyId: item.storyId,
        gapReason: item.gapReason,
        included: true,
        notes: item.notes ?? ""
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
      source: PrepQuestionSource;
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
      audience: existing.audience,
      target: replacement.target,
      sortOrder: existing.sortOrder,
      source: replacement.source,
      bankQuestionId: replacement.bankQuestionId,
      storyId: replacement.storyId,
      gapReason: undefined,
      included: existing.included,
      notes: existing.notes
    };
    const updated = { ...plan, questions, updatedAt: nowIso() };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async patchPlanQuestion(
    userId: string,
    planId: string,
    questionId: string,
    patch: PlanQuestionPatchInput
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const index = plan.questions.findIndex((q) => q.id === questionId);
    if (index < 0) return null;
    const existing = plan.questions[index]!;
    const questions = [...plan.questions];
    questions[index] = {
      ...existing,
      text: patch.text ?? existing.text,
      category: patch.category ?? existing.category,
      notes: patch.notes ?? existing.notes,
      included: patch.included ?? existing.included,
      source: patch.source ?? existing.source,
      gapReason: patch.text && patch.text !== existing.text ? undefined : existing.gapReason
    };
    const updated = { ...plan, questions, updatedAt: nowIso() };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async addPlanQuestion(
    userId: string,
    planId: string,
    input: PlanQuestionCreateInput
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const maxOrder = plan.questions.reduce((max, q) => Math.max(max, q.sortOrder), -1);
    const audience = input.audience ?? "candidate";
    const question = {
      id: nanoid(),
      text: input.text,
      category: categoryForAudience(audience, input.category),
      audience,
      target: input.target ?? ("interview" as QuestionTarget),
      sortOrder: maxOrder + 1,
      source: "custom" as const,
      included: input.included ?? true,
      notes: input.notes ?? ""
    };
    const updated = {
      ...plan,
      questions: [...plan.questions, question],
      updatedAt: nowIso()
    };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async deletePlanQuestion(
    userId: string,
    planId: string,
    questionId: string
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    if (!plan.questions.some((q) => q.id === questionId)) return null;
    const questions = plan.questions
      .filter((q) => q.id !== questionId)
      .map((q, index) => ({ ...q, sortOrder: index }));
    const updated = { ...plan, questions, updatedAt: nowIso() };
    this.prepPlans.set(planId, updated);
    return updated;
  }

  async reorderPlanQuestions(
    userId: string,
    planId: string,
    orderedIds: string[]
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const byId = new Map(plan.questions.map((q) => [q.id, q]));
    if (orderedIds.length !== plan.questions.length) return null;
    if (new Set(orderedIds).size !== orderedIds.length) return null;
    if (!orderedIds.every((id) => byId.has(id))) return null;
    const questions = orderedIds.map((id, index) => ({
      ...byId.get(id)!,
      sortOrder: index
    }));
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
    input: {
      mode: InterviewMode;
      title: string;
      prepPlanId?: string;
      caseEntryId?: string;
      systemPrompt: string;
    }
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
      prompt: input.prompt ?? "",
      feedback: input.feedback,
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
      kind: input.kind ?? "cases",
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

  async listImportJobsForDoc(
    userId: string,
    knowledgeDocId: string,
    kind?: ImportJobKind
  ): Promise<InterviewImportJobRecord[]> {
    return [...this.importJobs.values()]
      .filter(
        (row) =>
          row.userId === userId &&
          row.knowledgeDocId === knowledgeDocId &&
          (!kind || row.kind === kind)
      )
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

  async deleteImportJob(userId: string, id: string): Promise<boolean> {
    const existing = await this.getImportJob(userId, id);
    if (!existing || !canDeleteImportJob(existing.status)) return false;
    this.importJobs.delete(id);
    return true;
  }

  async failInterruptedImportJobs(message: string): Promise<number> {
    let count = 0;
    for (const [id, job] of this.importJobs) {
      if (job.status !== "queued" && job.status !== "running") continue;
      this.importJobs.set(id, {
        ...job,
        status: "failed",
        message,
        updatedAt: nowIso()
      });
      count += 1;
    }
    return count;
  }

  async failInterruptedPrepPlans(message: string): Promise<number> {
    let count = 0;
    for (const [id, plan] of this.prepPlans) {
      if (plan.status !== "researching" && plan.status !== "curating") continue;
      this.prepPlans.set(id, {
        ...plan,
        status: "failed",
        failureReason: message,
        updatedAt: nowIso()
      });
      count += 1;
    }
    return count;
  }
}
