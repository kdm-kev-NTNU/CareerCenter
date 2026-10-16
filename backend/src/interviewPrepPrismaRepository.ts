import { PrismaClient } from "@prisma/client";
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
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionAudience,
  QuestionCategory,
  QuestionDiscardReason,
  QuestionTarget,
  VideoSimState,
  VideoSimulatorSettings
} from "@careercenter/shared";
import {
  isPlanSectionKey,
  canDeleteImportJob,
  canDeletePrepPlan,
  categoryForAudience,
  DEFAULT_RESEARCH_MODEL,
  defaultVideoSimulatorSettings,
  deletableImportJobStatuses,
  isResearchModel,
  parsePrepPlanPipelineStep
} from "@careercenter/shared";
import { ensureInterviewBibleCatalog } from "./interview/bibleCatalog.js";
import type {
  AbilityAttemptInput,
  BankQuestionFilter,
  BankQuestionInput,
  BankQuestionPatch,
  BankQuestionSummary,
  CaseEntryInput,
  ImportJobCreateInput,
  ImportJobUpdateInput,
  InterviewAbilityTestAttemptRecord,
  InterviewBankQuestionRecord,
  InterviewCaseEntryRecord,
  InterviewImportJobRecord,
  InterviewKnowledgeDoc,
  CandidateBackgroundDocumentInput,
  CandidateBackgroundNotesInput,
  CandidateBackgroundRecord,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewPrepRepository,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord,
  InterviewVideoRunRecord,
  InterviewVideoSettingsRecord,
  KnowledgeDocInput,
  PlanQuestionCreateInput,
  PlanQuestionPatchInput,
  PrepPlanCreateInput,
  VideoRunInput
} from "./interviewPrepRepository.js";
import type { InterviewFeedbackRubric } from "./interview/feedbackRubric.js";

export class InterviewPrepPrismaRepository implements InterviewPrepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]> {
    await ensureInterviewBibleCatalog(this.prisma, userId);
    const rows = await this.prisma.interviewKnowledgeDoc.findMany({
      where: { userId },
      orderBy: { title: "asc" }
    });
    return rows.map((row) => this.mapKnowledge(row));
  }

  async findKnowledgeByHash(userId: string, contentHash: string): Promise<InterviewKnowledgeDoc | null> {
    const row = await this.prisma.interviewKnowledgeDoc.findUnique({
      where: { userId_contentHash: { userId, contentHash } }
    });
    return row ? this.mapKnowledge(row) : null;
  }

  async createKnowledgeDoc(userId: string, input: KnowledgeDocInput): Promise<InterviewKnowledgeDoc> {
    const row = await this.prisma.interviewKnowledgeDoc.create({
      data: {
        userId,
        kind: input.kind ?? "other",
        title: input.title,
        content: input.content,
        sourceFilename: input.sourceFilename,
        originalFileKey: input.originalFileKey,
        contentHash: input.contentHash
      }
    });
    return this.mapKnowledge(row);
  }

  async updateKnowledgeDoc(
    userId: string,
    id: string,
    input: Partial<KnowledgeDocInput>
  ): Promise<InterviewKnowledgeDoc | null> {
    const existing = await this.prisma.interviewKnowledgeDoc.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.interviewKnowledgeDoc.update({
      where: { id },
      data: {
        kind: input.kind,
        title: input.title,
        content: input.content,
        sourceFilename: input.sourceFilename,
        originalFileKey: input.originalFileKey,
        contentHash: input.contentHash
      }
    });
    return this.mapKnowledge(row);
  }

  async deleteKnowledgeDoc(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.interviewKnowledgeDoc.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await this.prisma.interviewKnowledgeDoc.delete({ where: { id } });
    return true;
  }

  async insertBankQuestions(
    userId: string,
    knowledgeDocId: string,
    questions: BankQuestionInput[]
  ): Promise<number> {
    if (questions.length === 0) return 0;
    const result = await this.prisma.interviewBankQuestion.createMany({
      data: questions.map((item) => ({
        userId,
        knowledgeDocId,
        text: item.text,
        category: item.category,
        audience: item.audience ?? "candidate",
        origin: item.origin,
        sourceText: item.sourceText ?? item.text,
        cleanedAt: item.cleanedAt ? new Date(item.cleanedAt) : null,
        tags: item.tags,
        contentHash: item.contentHash
      })),
      skipDuplicates: true
    });
    return result.count;
  }

  async listBankQuestions(userId: string, filter?: BankQuestionFilter): Promise<InterviewBankQuestionRecord[]> {
    await ensureInterviewBibleCatalog(this.prisma, userId);
    const status = filter?.status ?? "active";
    const rows = await this.prisma.interviewBankQuestion.findMany({
      where: {
        userId,
        ...(status !== "all" ? { status } : {}),
        ...(filter?.audience ? { audience: filter.audience } : {}),
        ...(filter?.knowledgeDocId ? { knowledgeDocId: filter.knowledgeDocId } : {}),
        ...(filter?.uncleaned ? { cleanedAt: null } : {}),
        ...(filter?.category ? { category: filter.category } : {}),
        ...(filter?.tag ? { tags: { has: filter.tag } } : {}),
        ...(filter?.q
          ? {
              text: { contains: filter.q, mode: "insensitive" }
            }
          : {})
      },
      orderBy: { text: "asc" }
    });
    return rows.map((row) => this.mapBankQuestion(row));
  }

  async getBankQuestionsByIds(userId: string, ids: string[]): Promise<InterviewBankQuestionRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.interviewBankQuestion.findMany({
      where: { userId, id: { in: ids } }
    });
    return rows.map((row) => this.mapBankQuestion(row));
  }

  async updateBankQuestion(
    userId: string,
    id: string,
    patch: BankQuestionPatch
  ): Promise<InterviewBankQuestionRecord | null> {
    const existing = await this.prisma.interviewBankQuestion.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.interviewBankQuestion.update({
      where: { id },
      data: {
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.audience !== undefined ? { audience: patch.audience } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.discardReason !== undefined ? { discardReason: patch.discardReason } : {}),
        ...(patch.origin !== undefined ? { origin: patch.origin } : {}),
        ...(patch.cleanedAt !== undefined
          ? { cleanedAt: patch.cleanedAt === null ? null : new Date(patch.cleanedAt) }
          : {})
      }
    });
    return this.mapBankQuestion(row);
  }

  async deleteBankQuestions(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.prisma.interviewBankQuestion.deleteMany({ where: { userId, id: { in: ids } } });
    return result.count;
  }

  async resetBankQuestionCleanup(userId: string): Promise<number> {
    const result = await this.prisma.interviewBankQuestion.updateMany({
      where: { userId, status: "active", origin: { not: "manual" } },
      data: { cleanedAt: null }
    });
    return result.count;
  }

  async summarizeBankQuestions(userId: string): Promise<BankQuestionSummary> {
    await ensureInterviewBibleCatalog(this.prisma, userId);
    const [groups, uncleaned] = await Promise.all([
      this.prisma.interviewBankQuestion.groupBy({
        by: ["audience", "status"],
        where: { userId },
        _count: { _all: true }
      }),
      this.prisma.interviewBankQuestion.count({ where: { userId, status: "active", cleanedAt: null } })
    ]);
    const summary: BankQuestionSummary = {
      byAudience: { candidate: 0, ask_interviewer_personal: 0, ask_interviewer_company: 0 },
      discarded: 0,
      uncleaned
    };
    for (const group of groups) {
      if (group.status === "discarded") {
        summary.discarded += group._count._all;
      } else if (group.audience in summary.byAudience) {
        summary.byAudience[group.audience as QuestionAudience] += group._count._all;
      }
    }
    return summary;
  }

  async listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]> {
    await ensureInterviewBibleCatalog(this.prisma, userId);
    const rows = await this.prisma.interviewCaseEntry.findMany({
      where: { userId },
      orderBy: { title: "asc" }
    });
    return rows.map((row) => this.mapCase(row));
  }

  async searchCaseEntries(
    userId: string,
    filter?: { q?: string; sourceKind?: string; style?: string; approvalStatus?: string }
  ): Promise<InterviewCaseEntryRecord[]> {
    await ensureInterviewBibleCatalog(this.prisma, userId);
    const rows = await this.prisma.interviewCaseEntry.findMany({
      where: {
        userId,
        ...(filter?.sourceKind ? { sourceKind: filter.sourceKind } : {}),
        ...(filter?.style ? { caseStyle: filter.style } : {}),
        ...(filter?.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
        ...(filter?.q
          ? {
              OR: [
                { title: { contains: filter.q, mode: "insensitive" } },
                { prompt: { contains: filter.q, mode: "insensitive" } },
                { interviewerInfo: { contains: filter.q, mode: "insensitive" } },
                { solution: { contains: filter.q, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { title: "asc" }
    });
    return rows.map((row) => this.mapCase(row));
  }

  async findCaseByHash(userId: string, contentHash: string): Promise<InterviewCaseEntryRecord | null> {
    const row = await this.prisma.interviewCaseEntry.findUnique({
      where: { userId_contentHash: { userId, contentHash } }
    });
    return row ? this.mapCase(row) : null;
  }

  async createCaseEntry(userId: string, input: CaseEntryInput): Promise<InterviewCaseEntryRecord> {
    const row = await this.prisma.interviewCaseEntry.create({
      data: {
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
        originalFileKey: input.originalFileKey
      }
    });
    return this.mapCase(row);
  }

  async updateCaseEntry(
    userId: string,
    id: string,
    input: Partial<CaseEntryInput>
  ): Promise<InterviewCaseEntryRecord | null> {
    const existing = await this.prisma.interviewCaseEntry.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.interviewCaseEntry.update({
      where: { id },
      data: {
        knowledgeDocId: input.knowledgeDocId,
        title: input.title,
        prompt: input.prompt,
        interviewerInfo: input.interviewerInfo,
        solution: input.solution,
        sourceKind: input.sourceKind,
        caseStyle: input.caseStyle,
        companyTags: input.companyTags,
        contentHash: input.contentHash,
        approvalStatus: input.approvalStatus,
        originalFileKey: input.originalFileKey
      }
    });
    return this.mapCase(row);
  }

  async deleteCaseEntry(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.interviewCaseEntry.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await this.prisma.interviewCaseEntry.delete({ where: { id } });
    return true;
  }

  async approveCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null> {
    return this.updateCaseEntry(userId, id, { approvalStatus: "approved" });
  }

  async rejectCaseEntry(userId: string, id: string): Promise<InterviewCaseEntryRecord | null> {
    return this.updateCaseEntry(userId, id, { approvalStatus: "rejected" });
  }

  async listPrepPlans(userId: string): Promise<InterviewPrepPlanRecord[]> {
    const rows = await this.prisma.interviewPrepPlan.findMany({
      where: { userId },
      include: planIncludes,
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.mapPlan(row));
  }

  async getPrepPlan(userId: string, id: string): Promise<InterviewPrepPlanRecord | null> {
    const row = await this.prisma.interviewPrepPlan.findFirst({
      where: { id, userId },
      include: planIncludes
    });
    return row ? this.mapPlan(row) : null;
  }

  async deletePrepPlan(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({
      where: { id, userId },
      select: { status: true }
    });
    if (!existing || !canDeletePrepPlan(existing.status as PrepPlanStatus)) return false;
    // Matching the status just read keeps a plan that started research in the meantime.
    const result = await this.prisma.interviewPrepPlan.deleteMany({
      where: { id, userId, status: existing.status }
    });
    return result.count > 0;
  }

  async createPrepPlan(userId: string, input: PrepPlanCreateInput): Promise<InterviewPrepPlanRecord> {
    const row = await this.prisma.interviewPrepPlan.create({
      data: {
        userId,
        companyName: input.companyName,
        roleTitle: input.roleTitle,
        format: input.format,
        researchModel: input.researchModel,
        jobAdText: input.jobAdText ?? "",
        status: "draft"
      },
      include: planIncludes
    });
    return this.mapPlan(row);
  }

  async updatePrepPlanStatus(
    userId: string,
    id: string,
    status: PrepPlanStatus,
    failureReason?: string
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.interviewPrepPlan.update({
      where: { id },
      data: { status, failureReason: failureReason ?? null },
      include: planIncludes
    });
    return this.mapPlan(row);
  }

  async setPrepPlanPipeline(
    userId: string,
    id: string,
    input: {
      pipelineStep: InterviewPrepPlanRecord["pipelineStep"];
      researchNotes?: string;
      searchSnippet?: string;
      companyProfileJson?: string;
      companyReportJson?: string;
      curationFilledCount?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.interviewPrepPlan.update({
      where: { id },
      data: {
        pipelineStep: input.pipelineStep,
        ...(input.researchNotes !== undefined ? { researchNotes: input.researchNotes } : {}),
        ...(input.searchSnippet !== undefined ? { searchSnippet: input.searchSnippet } : {}),
        ...(input.companyProfileJson !== undefined ? { companyProfileJson: input.companyProfileJson } : {}),
        ...(input.companyReportJson !== undefined ? { companyReportJson: input.companyReportJson } : {}),
        ...(input.curationFilledCount !== undefined
          ? { curationFilledCount: input.curationFilledCount }
          : {})
      },
      include: planIncludes
    });
    return this.mapPlan(row);
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
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const round = input.clarificationRound ?? 1;
    await this.prisma.$transaction([
      this.prisma.interviewPrepClarification.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlan.update({
        where: { id },
        data: {
          researchNotes: input.researchNotes,
          clarificationRound: round,
          ...(input.companyProfileJson !== undefined
            ? { companyProfileJson: input.companyProfileJson }
            : {}),
          ...(input.companyReportJson !== undefined
            ? { companyReportJson: input.companyReportJson }
            : {}),
          clarifications: {
            create: input.clarifications.map((item) => ({
              question: item.question,
              sortOrder: item.sortOrder,
              round
            }))
          }
        }
      })
    ]);
    return this.getPrepPlan(userId, id);
  }

  async appendClarificationRound(
    userId: string,
    planId: string,
    clarifications: Array<{ question: string; sortOrder: number }>,
    round: number
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id: planId, userId } });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.interviewPrepPlan.update({
        where: { id: planId },
        data: {
          clarificationRound: round,
          clarifications: {
            create: clarifications.map((item) => ({
              question: item.question,
              sortOrder: item.sortOrder,
              round
            }))
          }
        }
      })
    ]);
    return this.getPrepPlan(userId, planId);
  }

  async saveClarificationAnswers(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    await this.prisma.$transaction(
      answers.map((item) =>
        this.prisma.interviewPrepClarification.updateMany({
          where: { id: item.id, planId },
          data: { answer: item.answer }
        })
      )
    );
    return this.getPrepPlan(userId, planId);
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
      curationFilledCount?: number;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.interviewPrepQuestion.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlan.update({
        where: { id },
        data: {
          ...(input.curationFilledCount !== undefined
            ? { curationFilledCount: input.curationFilledCount }
            : {}),
          questions: {
            create: input.questions.map((item, index) => ({
              text: item.text,
              category: categoryForAudience(item.audience ?? "candidate", item.category),
              audience: item.audience ?? "candidate",
              target: item.target,
              sortOrder: index,
              source: item.source ?? "generated",
              bankQuestionId: item.bankQuestionId,
              storyId: item.storyId,
              gapReason: item.gapReason,
              notes: item.notes ?? ""
            }))
          }
        }
      })
    ]);
    return this.getPrepPlan(userId, id);
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
    const existing = plan.questions.find((q) => q.id === questionId);
    if (!existing) return null;
    await this.prisma.interviewPrepQuestion.updateMany({
      where: { id: questionId, planId },
      data: {
        text: replacement.text,
        category: replacement.category,
        target: replacement.target,
        source: replacement.source,
        bankQuestionId: replacement.bankQuestionId ?? null,
        storyId: replacement.storyId ?? null,
        gapReason: null
      }
    });
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async patchPlanQuestion(
    userId: string,
    planId: string,
    questionId: string,
    patch: PlanQuestionPatchInput
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const existing = plan.questions.find((q) => q.id === questionId);
    if (!existing) return null;
    const textChanged = patch.text !== undefined && patch.text !== existing.text;
    await this.prisma.interviewPrepQuestion.updateMany({
      where: { id: questionId, planId },
      data: {
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.included !== undefined ? { included: patch.included } : {}),
        ...(patch.source !== undefined ? { source: patch.source } : {}),
        ...(textChanged ? { gapReason: null } : {})
      }
    });
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async addPlanQuestion(
    userId: string,
    planId: string,
    input: PlanQuestionCreateInput
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const maxOrder = plan.questions.reduce((max, q) => Math.max(max, q.sortOrder), -1);
    await this.prisma.interviewPrepQuestion.create({
      data: {
        planId,
        text: input.text,
        category: categoryForAudience(input.audience ?? "candidate", input.category),
        audience: input.audience ?? "candidate",
        target: input.target ?? "interview",
        sortOrder: maxOrder + 1,
        source: "custom",
        included: input.included ?? true,
        notes: input.notes ?? ""
      }
    });
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async deletePlanQuestion(
    userId: string,
    planId: string,
    questionId: string
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    if (!plan.questions.some((q) => q.id === questionId)) return null;
    await this.prisma.interviewPrepQuestion.deleteMany({ where: { id: questionId, planId } });
    const remaining = plan.questions
      .filter((q) => q.id !== questionId)
      .map((q, index) => ({ id: q.id, sortOrder: index }));
    await Promise.all(
      remaining.map((item) =>
        this.prisma.interviewPrepQuestion.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder }
        })
      )
    );
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async reorderPlanQuestions(
    userId: string,
    planId: string,
    orderedIds: string[]
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    const existingIds = new Set(plan.questions.map((q) => q.id));
    if (orderedIds.length !== plan.questions.length) return null;
    if (new Set(orderedIds).size !== orderedIds.length) return null;
    if (!orderedIds.every((id) => existingIds.has(id))) return null;
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.interviewPrepQuestion.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async setPlanQuestionStory(
    userId: string,
    planId: string,
    questionId: string,
    storyId: string | null
  ): Promise<InterviewPrepPlanRecord | null> {
    const plan = await this.getPrepPlan(userId, planId);
    if (!plan) return null;
    if (!plan.questions.some((q) => q.id === questionId)) return null;
    await this.prisma.interviewPrepQuestion.updateMany({
      where: { id: questionId, planId },
      data: { storyId }
    });
    await this.prisma.interviewPrepPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() }
    });
    return this.getPrepPlan(userId, planId);
  }

  async getSimulatorSettings(userId: string, mode: InterviewMode): Promise<InterviewSimulatorSettingsRecord | null> {
    const row = await this.prisma.interviewSimulatorSettings.findUnique({
      where: { userId_mode: { userId, mode } }
    });
    return row ? this.mapSettings(row) : null;
  }

  async upsertSimulatorSettings(
    userId: string,
    input: InterviewSimulatorSettingsRecord
  ): Promise<InterviewSimulatorSettingsRecord> {
    const row = await this.prisma.interviewSimulatorSettings.upsert({
      where: { userId_mode: { userId, mode: input.mode } },
      create: {
        userId,
        mode: input.mode,
        companyName: input.companyName,
        tone: input.tone,
        language: input.language,
        essentialsSheet: input.essentialsSheet
      },
      update: {
        companyName: input.companyName,
        tone: input.tone,
        language: input.language,
        essentialsSheet: input.essentialsSheet
      }
    });
    return this.mapSettings(row);
  }

  async listSessions(userId: string, mode?: InterviewMode): Promise<InterviewSessionRecord[]> {
    const rows = await this.prisma.interviewSession.findMany({
      where: { userId, ...(mode ? { mode } : {}) },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.mapSession(row));
  }

  async getSession(userId: string, id: string): Promise<InterviewSessionRecord | null> {
    const row = await this.prisma.interviewSession.findFirst({ where: { id, userId } });
    return row ? this.mapSession(row) : null;
  }

  async createSession(
    userId: string,
    input: {
      mode: InterviewMode;
      title: string;
      prepPlanId?: string;
      planSection?: PlanSectionKey;
      caseEntryId?: string;
      systemPrompt: string;
    }
  ): Promise<InterviewSessionRecord> {
    const row = await this.prisma.interviewSession.create({
      data: {
        userId,
        mode: input.mode,
        title: input.title,
        prepPlanId: input.prepPlanId,
        planSection: input.planSection,
        caseEntryId: input.caseEntryId,
        messages: {
          create: { role: "system", content: input.systemPrompt }
        }
      }
    });
    return this.mapSession(row);
  }

  async listSessionMessages(userId: string, sessionId: string): Promise<InterviewMessageRecord[]> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return [];
    const rows = await this.prisma.interviewMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" }
    });
    return rows.map((row) => this.mapMessage(row));
  }

  async appendSessionMessage(
    userId: string,
    sessionId: string,
    role: InterviewMessageRecord["role"],
    content: string
  ): Promise<InterviewMessageRecord | null> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return null;
    const row = await this.prisma.interviewMessage.create({
      data: { sessionId, role, content }
    });
    await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });
    return this.mapMessage(row);
  }

  async finishSession(
    userId: string,
    sessionId: string,
    feedback: InterviewFeedbackRubric
  ): Promise<InterviewSessionRecord | null> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return null;
    const result = await this.prisma.interviewSession.updateMany({
      where: { id: sessionId, userId, finishedAt: null },
      data: {
        feedbackJson: JSON.stringify(feedback),
        finishedAt: new Date()
      }
    });
    if (result.count === 0) return null;
    const row = await this.prisma.interviewSession.findFirst({ where: { id: sessionId, userId } });
    return row ? this.mapSession(row) : null;
  }

  async listAbilityAttempts(userId: string, limit = 50): Promise<InterviewAbilityTestAttemptRecord[]> {
    const rows = await this.prisma.interviewAbilityTestAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return rows.map((row) => this.mapAbilityAttempt(row));
  }

  async createAbilityAttempt(userId: string, input: AbilityAttemptInput): Promise<InterviewAbilityTestAttemptRecord> {
    const row = await this.prisma.interviewAbilityTestAttempt.create({
      data: { userId, ...input }
    });
    return this.mapAbilityAttempt(row);
  }

  async getVideoSettings(userId: string): Promise<InterviewVideoSettingsRecord | null> {
    const row = await this.prisma.interviewVideoSettings.findUnique({ where: { userId } });
    return row ? this.mapVideoSettings(row) : null;
  }

  async upsertVideoSettings(userId: string, settings: VideoSimulatorSettings): Promise<InterviewVideoSettingsRecord> {
    const row = await this.prisma.interviewVideoSettings.upsert({
      where: { userId },
      create: {
        userId,
        thinkSeconds: settings.thinkSeconds,
        answerSeconds: settings.answerSeconds,
        promptsJson: JSON.stringify(settings.prompts),
        ratingModel: settings.ratingModel
      },
      update: {
        thinkSeconds: settings.thinkSeconds,
        answerSeconds: settings.answerSeconds,
        promptsJson: JSON.stringify(settings.prompts),
        ratingModel: settings.ratingModel
      }
    });
    return this.mapVideoSettings(row);
  }

  async listVideoRuns(userId: string, limit = 20): Promise<InterviewVideoRunRecord[]> {
    const rows = await this.prisma.interviewVideoRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return rows.map((row) => this.mapVideoRun(row));
  }

  async createVideoRun(userId: string, input: VideoRunInput): Promise<InterviewVideoRunRecord> {
    const row = await this.prisma.interviewVideoRun.create({
      data: {
        userId,
        settingsJson: JSON.stringify(input.settings),
        state: input.state,
        cardIndex: input.cardIndex,
        blobKey: input.blobKey,
        transcript: input.transcript,
        prompt: input.prompt ?? "",
        feedbackJson: input.feedback ? JSON.stringify(input.feedback) : null
      }
    });
    return this.mapVideoRun(row);
  }

  async createImportJob(userId: string, input: ImportJobCreateInput): Promise<InterviewImportJobRecord> {
    const row = await this.prisma.interviewImportJob.create({
      data: {
        userId,
        knowledgeDocId: input.knowledgeDocId,
        kind: input.kind ?? "cases"
      }
    });
    return this.mapImportJob(row);
  }

  async getImportJob(userId: string, id: string): Promise<InterviewImportJobRecord | null> {
    const row = await this.prisma.interviewImportJob.findFirst({ where: { id, userId } });
    return row ? this.mapImportJob(row) : null;
  }

  async listImportJobs(userId: string): Promise<InterviewImportJobRecord[]> {
    const rows = await this.prisma.interviewImportJob.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.mapImportJob(row));
  }

  async listImportJobsForDoc(
    userId: string,
    knowledgeDocId: string,
    kind?: ImportJobKind
  ): Promise<InterviewImportJobRecord[]> {
    const rows = await this.prisma.interviewImportJob.findMany({
      where: { userId, knowledgeDocId, ...(kind ? { kind } : {}) },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.mapImportJob(row));
  }

  async updateImportJob(
    userId: string,
    id: string,
    input: ImportJobUpdateInput
  ): Promise<InterviewImportJobRecord | null> {
    const existing = await this.getImportJob(userId, id);
    if (!existing) return null;
    const row = await this.prisma.interviewImportJob.update({
      where: { id },
      data: {
        status: input.status,
        progress: input.progress,
        message: input.message,
        resultJson: input.resultJson
      }
    });
    return this.mapImportJob(row);
  }

  async deleteImportJob(userId: string, id: string): Promise<boolean> {
    const existing = await this.getImportJob(userId, id);
    if (!existing || !canDeleteImportJob(existing.status)) return false;
    const result = await this.prisma.interviewImportJob.deleteMany({
      where: { id, userId, status: { in: [...deletableImportJobStatuses] } }
    });
    return result.count > 0;
  }

  async failInterruptedImportJobs(message: string): Promise<number> {
    const result = await this.prisma.interviewImportJob.updateMany({
      where: { status: { in: ["queued", "running"] } },
      data: { status: "failed", message, progress: 100 }
    });
    return result.count;
  }

  async failInterruptedPrepPlans(message: string): Promise<number> {
    const result = await this.prisma.interviewPrepPlan.updateMany({
      where: { status: { in: ["researching", "curating"] } },
      data: { status: "failed", failureReason: message }
    });
    return result.count;
  }

  private mapKnowledge(row: {
    id: string;
    userId: string;
    kind: string;
    title: string;
    content: string;
    sourceFilename: string | null;
    originalFileKey: string | null;
    contentHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewKnowledgeDoc {
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind as KnowledgeDocKind,
      title: row.title,
      content: row.content,
      sourceFilename: row.sourceFilename ?? undefined,
      originalFileKey: row.originalFileKey ?? undefined,
      contentHash: row.contentHash,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapBankQuestion(row: {
    id: string;
    userId: string;
    knowledgeDocId: string;
    text: string;
    category: string;
    audience: string;
    status: string;
    discardReason: string | null;
    origin: string;
    sourceText: string | null;
    cleanedAt: Date | null;
    tags: string[];
    contentHash: string;
    createdAt: Date;
  }): InterviewBankQuestionRecord {
    return {
      id: row.id,
      userId: row.userId,
      knowledgeDocId: row.knowledgeDocId,
      text: row.text,
      category: row.category as QuestionCategory,
      audience: row.audience as QuestionAudience,
      status: row.status as BankQuestionStatus,
      discardReason: (row.discardReason as QuestionDiscardReason | null) ?? undefined,
      origin: row.origin as BankQuestionOrigin,
      sourceText: row.sourceText ?? row.text,
      tags: row.tags,
      contentHash: row.contentHash,
      cleanedAt: row.cleanedAt?.toISOString(),
      createdAt: row.createdAt.toISOString()
    };
  }

  private mapCase(row: {
    id: string;
    userId: string;
    knowledgeDocId: string | null;
    title: string;
    prompt: string;
    interviewerInfo: string;
    solution: string;
    sourceKind: string;
    caseStyle: string | null;
    companyTags: string[];
    contentHash: string;
    approvalStatus: string;
    originalFileKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewCaseEntryRecord {
    return {
      id: row.id,
      userId: row.userId,
      knowledgeDocId: row.knowledgeDocId ?? undefined,
      title: row.title,
      prompt: row.prompt,
      interviewerInfo: row.interviewerInfo,
      solution: row.solution,
      sourceKind: row.sourceKind as CaseSourceKind,
      caseStyle: (row.caseStyle as CaseStyle | null) ?? undefined,
      companyTags: row.companyTags,
      contentHash: row.contentHash,
      approvalStatus: row.approvalStatus as CaseApprovalStatus,
      originalFileKey: row.originalFileKey ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapPlan(row: PlanRow): InterviewPrepPlanRecord {
    return {
      id: row.id,
      userId: row.userId,
      companyName: row.companyName,
      roleTitle: row.roleTitle,
      format: row.format as PrepFormat,
      researchModel: isResearchModel(row.researchModel) ? row.researchModel : DEFAULT_RESEARCH_MODEL,
      status: row.status as PrepPlanStatus,
      pipelineStep: parsePrepPlanPipelineStep(row.pipelineStep),
      jobAdText: row.jobAdText,
      researchNotes: row.researchNotes,
      searchSnippet: row.searchSnippet,
      companyProfileJson: row.companyProfileJson,
      companyReportJson: row.companyReportJson,
      clarificationRound: row.clarificationRound,
      curationFilledCount: row.curationFilledCount,
      failureReason: row.failureReason ?? undefined,
      clarifications: row.clarifications
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          question: item.question,
          answer: item.answer,
          sortOrder: item.sortOrder
        })),
      questions: row.questions
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          text: item.text,
          category: item.category as QuestionCategory,
          audience: item.audience as QuestionAudience,
          target: item.target as QuestionTarget,
          sortOrder: item.sortOrder,
          source: (item.source as PrepQuestionSource | null) ?? "generated",
          bankQuestionId: item.bankQuestionId ?? undefined,
          storyId: item.storyId ?? undefined,
          gapReason: item.gapReason ?? undefined,
          included: item.included,
          notes: item.notes
        })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async getCandidateBackground(userId: string): Promise<CandidateBackgroundRecord | null> {
    const row = await this.prisma.candidateBackground.findUnique({ where: { userId } });
    return row ? this.mapCandidateBackground(row) : null;
  }

  async upsertCandidateBackgroundNotes(
    userId: string,
    input: CandidateBackgroundNotesInput
  ): Promise<CandidateBackgroundRecord> {
    const row = await this.prisma.candidateBackground.upsert({
      where: { userId },
      create: { userId, notes: input.notes },
      update: { notes: input.notes }
    });
    return this.mapCandidateBackground(row);
  }

  async upsertCandidateBackgroundDocument(
    userId: string,
    input: CandidateBackgroundDocumentInput
  ): Promise<CandidateBackgroundRecord> {
    const now = new Date();
    const data =
      input.kind === "cv"
        ? { cvText: input.text, cvFileName: input.fileName, cvUpdatedAt: now }
        : {
            transcriptText: input.text,
            transcriptFileName: input.fileName,
            transcriptUpdatedAt: now
          };
    const row = await this.prisma.candidateBackground.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data
    });
    return this.mapCandidateBackground(row);
  }

  private mapCandidateBackground(row: {
    userId: string;
    cvText: string;
    cvFileName: string;
    cvUpdatedAt: Date | null;
    transcriptText: string;
    transcriptFileName: string;
    transcriptUpdatedAt: Date | null;
    notes: string;
    updatedAt: Date;
  }): CandidateBackgroundRecord {
    return {
      userId: row.userId,
      cvText: row.cvText,
      cvFileName: row.cvFileName,
      cvUpdatedAt: row.cvUpdatedAt?.toISOString() ?? null,
      transcriptText: row.transcriptText,
      transcriptFileName: row.transcriptFileName,
      transcriptUpdatedAt: row.transcriptUpdatedAt?.toISOString() ?? null,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapSettings(row: {
    userId: string;
    mode: string;
    companyName: string;
    tone: string;
    language: string;
    essentialsSheet: string | null;
  }): InterviewSimulatorSettingsRecord {
    return {
      userId: row.userId,
      mode: row.mode as InterviewMode,
      companyName: row.companyName,
      tone: row.tone,
      language: row.language,
      essentialsSheet: row.essentialsSheet
    };
  }

  private mapSession(row: {
    id: string;
    userId: string;
    mode: string;
    title: string;
    prepPlanId: string | null;
    planSection: string | null;
    caseEntryId: string | null;
    feedbackJson: string | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewSessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      mode: row.mode as InterviewMode,
      title: row.title,
      prepPlanId: row.prepPlanId ?? undefined,
      planSection: row.planSection && isPlanSectionKey(row.planSection) ? row.planSection : undefined,
      caseEntryId: row.caseEntryId ?? undefined,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as InterviewFeedbackRubric) : undefined,
      finishedAt: row.finishedAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapMessage(row: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: Date;
  }): InterviewMessageRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      role: row.role as InterviewMessageRecord["role"],
      content: row.content,
      createdAt: row.createdAt.toISOString()
    };
  }

  private mapImportJob(row: {
    id: string;
    userId: string;
    knowledgeDocId: string;
    kind?: string;
    status: string;
    progress: number;
    message: string;
    resultJson: string;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewImportJobRecord {
    return {
      id: row.id,
      userId: row.userId,
      knowledgeDocId: row.knowledgeDocId,
      kind: ((row.kind ?? "cases") as ImportJobKind),
      status: row.status as ImportJobStatus,
      progress: row.progress,
      message: row.message,
      resultJson: row.resultJson,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapAbilityAttempt(row: {
    id: string;
    userId: string;
    kind: string;
    seed: number;
    correct: boolean;
    durationMs: number;
    createdAt: Date;
  }): InterviewAbilityTestAttemptRecord {
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind as AbilityTestKind,
      seed: row.seed,
      correct: row.correct,
      durationMs: row.durationMs,
      createdAt: row.createdAt.toISOString()
    };
  }

  private mapVideoSettings(row: {
    userId: string;
    thinkSeconds: number;
    answerSeconds: number;
    promptsJson: string;
    ratingModel: string;
    updatedAt: Date;
  }): InterviewVideoSettingsRecord {
    return {
      userId: row.userId,
      thinkSeconds: row.thinkSeconds,
      answerSeconds: row.answerSeconds,
      promptsJson: row.promptsJson || JSON.stringify(defaultVideoSimulatorSettings.prompts),
      ratingModel: row.ratingModel || defaultVideoSimulatorSettings.ratingModel,
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapVideoRun(row: {
    id: string;
    userId: string;
    settingsJson: string;
    state: string;
    cardIndex: number | null;
    blobKey: string | null;
    transcript: string;
    prompt: string;
    feedbackJson: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): InterviewVideoRunRecord {
    return {
      id: row.id,
      userId: row.userId,
      settingsJson: row.settingsJson,
      state: row.state as VideoSimState,
      cardIndex: row.cardIndex ?? undefined,
      blobKey: row.blobKey ?? undefined,
      transcript: row.transcript,
      prompt: row.prompt,
      feedback: row.feedbackJson ? (JSON.parse(row.feedbackJson) as InterviewFeedbackRubric) : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

const planIncludes = {
  clarifications: true,
  questions: true
} as const;

type PlanRow = {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  format: string;
  researchModel: string;
  status: string;
  pipelineStep: string;
  jobAdText: string;
  researchNotes: string;
  searchSnippet: string;
  companyProfileJson: string;
  companyReportJson: string;
  clarificationRound: number;
  curationFilledCount: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  clarifications: Array<{ id: string; question: string; answer: string; sortOrder: number }>;
  questions: Array<{
    id: string;
    text: string;
    category: string;
    audience: string;
    target: string;
    sortOrder: number;
    source: string | null;
    bankQuestionId: string | null;
    storyId: string | null;
    gapReason: string | null;
    included: boolean;
    notes: string;
  }>;
};
