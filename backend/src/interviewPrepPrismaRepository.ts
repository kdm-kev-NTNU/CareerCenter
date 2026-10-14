import { PrismaClient } from "@prisma/client";
import type {
  AbilityTestKind,
  CaseApprovalStatus,
  CaseSourceKind,
  CaseStyle,
  ImportJobStatus,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanStatus,
  PrepQuestionSource,
  QuestionCategory,
  QuestionTarget,
  StarRubricCriterion,
  VideoSimState,
  VideoSimulatorSettings
} from "@careercenter/shared";
import { defaultVideoSimulatorSettings } from "@careercenter/shared";
import { parseStarScores } from "./interview/meccaMappers.js";
import type {
  AbilityAttemptInput,
  CaseEntryInput,
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
  KnowledgeDocInput,
  PrepPlanCreateInput,
  RepertoireLogInput,
  StoryBankInput,
  VideoRunInput
} from "./interviewPrepRepository.js";
import type { InterviewFeedbackRubric } from "./interview/feedbackRubric.js";

export class InterviewPrepPrismaRepository implements InterviewPrepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]> {
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

  async replaceBankQuestionsForDoc(
    userId: string,
    knowledgeDocId: string,
    questions: Array<{ text: string; category: QuestionCategory; tags: string[]; contentHash: string }>
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.interviewBankQuestion.deleteMany({ where: { userId, knowledgeDocId } }),
      ...(questions.length > 0
        ? [
            this.prisma.interviewBankQuestion.createMany({
              data: questions.map((item) => ({
                userId,
                knowledgeDocId,
                text: item.text,
                category: item.category,
                tags: item.tags,
                contentHash: item.contentHash
              }))
            })
          ]
        : [])
    ]);
  }

  async listBankQuestions(
    userId: string,
    filter?: { q?: string; category?: string; tag?: string }
  ): Promise<InterviewBankQuestionRecord[]> {
    const rows = await this.prisma.interviewBankQuestion.findMany({
      where: {
        userId,
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

  async listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]> {
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

  async createPrepPlan(userId: string, input: PrepPlanCreateInput): Promise<InterviewPrepPlanRecord> {
    const row = await this.prisma.interviewPrepPlan.create({
      data: {
        userId,
        companyName: input.companyName,
        roleTitle: input.roleTitle,
        format: input.format,
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
        target: QuestionTarget;
        source: PrepQuestionSource;
        bankQuestionId?: string;
        storyId?: string;
        gapReason?: string;
      }>;
      tasks: Array<{ title: string; description: string }>;
      recommendedCaseIds?: string[];
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.interviewPrepQuestion.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepTask.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlanCase.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlan.update({
        where: { id },
        data: {
          questions: {
            create: input.questions.map((item, index) => ({
              text: item.text,
              category: item.category,
              target: item.target,
              sortOrder: index,
              source: item.source ?? "generated",
              bankQuestionId: item.bankQuestionId,
              storyId: item.storyId,
              gapReason: item.gapReason
            }))
          },
          tasks: {
            create: input.tasks.map((item, index) => ({
              title: item.title,
              description: item.description,
              sortOrder: index
            }))
          },
          recommendedCases: {
            create: (input.recommendedCaseIds ?? []).map((caseEntryId, index) => ({
              caseEntryId,
              sortOrder: index
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
    input: { mode: InterviewMode; title: string; prepPlanId?: string; caseEntryId?: string; systemPrompt: string }
  ): Promise<InterviewSessionRecord> {
    const row = await this.prisma.interviewSession.create({
      data: {
        userId,
        mode: input.mode,
        title: input.title,
        prepPlanId: input.prepPlanId,
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

  async listStoryBankEntries(userId: string): Promise<InterviewStoryBankEntryRecord[]> {
    const rows = await this.prisma.interviewStoryBankEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((row) => this.mapStory(row));
  }

  async getStoryBankEntry(userId: string, id: string): Promise<InterviewStoryBankEntryRecord | null> {
    const row = await this.prisma.interviewStoryBankEntry.findFirst({ where: { id, userId } });
    return row ? this.mapStory(row) : null;
  }

  async createStoryBankEntry(userId: string, input: StoryBankInput): Promise<InterviewStoryBankEntryRecord> {
    const row = await this.prisma.interviewStoryBankEntry.create({
      data: { userId, ...input }
    });
    return this.mapStory(row);
  }

  async updateStoryBankEntry(
    userId: string,
    id: string,
    input: Partial<StoryBankInput>
  ): Promise<InterviewStoryBankEntryRecord | null> {
    const existing = await this.getStoryBankEntry(userId, id);
    if (!existing) return null;
    const row = await this.prisma.interviewStoryBankEntry.update({
      where: { id },
      data: input
    });
    return this.mapStory(row);
  }

  async deleteStoryBankEntry(userId: string, id: string): Promise<boolean> {
    const existing = await this.getStoryBankEntry(userId, id);
    if (!existing) return false;
    await this.prisma.interviewStoryBankEntry.delete({ where: { id } });
    return true;
  }

  async listStoryScores(userId: string, storyId: string): Promise<InterviewStoryScoreRecord[]> {
    const story = await this.getStoryBankEntry(userId, storyId);
    if (!story) return [];
    const rows = await this.prisma.interviewStoryScore.findMany({
      where: { storyId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => this.mapStoryScore(row));
  }

  async addStoryScore(
    userId: string,
    storyId: string,
    input: { scores: Record<StarRubricCriterion, number>; sum: number; note: string }
  ): Promise<InterviewStoryScoreRecord | null> {
    const story = await this.getStoryBankEntry(userId, storyId);
    if (!story) return null;
    const row = await this.prisma.interviewStoryScore.create({
      data: {
        storyId,
        scoresJson: JSON.stringify(input.scores),
        sum: input.sum,
        note: input.note
      }
    });
    await this.prisma.interviewStoryBankEntry.update({
      where: { id: storyId },
      data: { updatedAt: new Date() }
    });
    return this.mapStoryScore(row);
  }

  async listRepertoireLogs(userId: string): Promise<InterviewCaseRepertoireLogRecord[]> {
    const rows = await this.prisma.interviewCaseRepertoireLog.findMany({
      where: { userId },
      orderBy: { practicedAt: "desc" }
    });
    return rows.map((row) => this.mapRepertoire(row));
  }

  async createRepertoireLog(userId: string, input: RepertoireLogInput): Promise<InterviewCaseRepertoireLogRecord> {
    const row = await this.prisma.interviewCaseRepertoireLog.create({
      data: {
        userId,
        caseEntryId: input.caseEntryId,
        title: input.title,
        company: input.company ?? "",
        format: input.format ?? "",
        tested: input.tested ?? "",
        improvement: input.improvement ?? "",
        outcome: input.outcome,
        notes: input.notes,
        practicedAt: input.practicedAt ? new Date(input.practicedAt) : undefined
      }
    });
    return this.mapRepertoire(row);
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
        promptsJson: JSON.stringify(settings.prompts)
      },
      update: {
        thinkSeconds: settings.thinkSeconds,
        answerSeconds: settings.answerSeconds,
        promptsJson: JSON.stringify(settings.prompts)
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
        transcript: input.transcript
      }
    });
    return this.mapVideoRun(row);
  }

  async createImportJob(userId: string, input: ImportJobCreateInput): Promise<InterviewImportJobRecord> {
    const row = await this.prisma.interviewImportJob.create({
      data: {
        userId,
        knowledgeDocId: input.knowledgeDocId
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
      tags: row.tags,
      contentHash: row.contentHash,
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
      status: row.status as PrepPlanStatus,
      researchNotes: row.researchNotes,
      companyProfileJson: row.companyProfileJson,
      clarificationRound: row.clarificationRound,
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
          target: item.target as QuestionTarget,
          sortOrder: item.sortOrder,
          source: (item.source as PrepQuestionSource | null) ?? "generated",
          bankQuestionId: item.bankQuestionId ?? undefined,
          storyId: item.storyId ?? undefined,
          gapReason: item.gapReason ?? undefined
        })),
      recommendedCases: row.recommendedCases
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          caseEntryId: item.caseEntryId,
          title: item.caseEntry.title,
          prompt: item.caseEntry.prompt,
          sourceKind: item.caseEntry.sourceKind as CaseSourceKind,
          sortOrder: item.sortOrder
        })),
      tasks: row.tasks
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          sortOrder: item.sortOrder,
          done: item.done
        })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapSettings(row: {
    userId: string;
    mode: string;
    companyName: string;
    tone: string;
    language: string;
    essentialsSheet: string;
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

  private mapStory(row: {
    id: string;
    userId: string;
    title: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }): InterviewStoryBankEntryRecord {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      situation: row.situation,
      task: row.task,
      action: row.action,
      result: row.result,
      tags: row.tags,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapStoryScore(row: {
    id: string;
    storyId: string;
    scoresJson: string;
    sum: number;
    note: string;
    createdAt: Date;
  }): InterviewStoryScoreRecord {
    return {
      id: row.id,
      storyId: row.storyId,
      scores: parseStarScores(row.scoresJson),
      sum: row.sum,
      note: row.note,
      createdAt: row.createdAt.toISOString()
    };
  }

  private mapRepertoire(row: {
    id: string;
    userId: string;
    caseEntryId: string | null;
    title: string;
    company: string;
    format: string;
    tested: string;
    improvement: string;
    outcome: string;
    notes: string;
    practicedAt: Date;
  }): InterviewCaseRepertoireLogRecord {
    return {
      id: row.id,
      userId: row.userId,
      caseEntryId: row.caseEntryId ?? undefined,
      title: row.title,
      company: row.company,
      format: row.format,
      tested: row.tested,
      improvement: row.improvement,
      outcome: row.outcome,
      notes: row.notes,
      practicedAt: row.practicedAt.toISOString()
    };
  }

  private mapImportJob(row: {
    id: string;
    userId: string;
    knowledgeDocId: string;
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
    updatedAt: Date;
  }): InterviewVideoSettingsRecord {
    return {
      userId: row.userId,
      thinkSeconds: row.thinkSeconds,
      answerSeconds: row.answerSeconds,
      promptsJson: row.promptsJson || JSON.stringify(defaultVideoSimulatorSettings.prompts),
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

const planIncludes = {
  clarifications: true,
  questions: true,
  tasks: true,
  recommendedCases: {
    include: {
      caseEntry: true
    }
  }
} as const;

type PlanRow = {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  format: string;
  status: string;
  researchNotes: string;
  companyProfileJson: string;
  clarificationRound: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  clarifications: Array<{ id: string; question: string; answer: string; sortOrder: number }>;
  questions: Array<{
    id: string;
    text: string;
    category: string;
    target: string;
    sortOrder: number;
    source: string | null;
    bankQuestionId: string | null;
    storyId: string | null;
    gapReason: string | null;
  }>;
  recommendedCases: Array<{
    id: string;
    caseEntryId: string;
    sortOrder: number;
    caseEntry: {
      title: string;
      prompt: string;
      sourceKind: string;
    };
  }>;
  tasks: Array<{ id: string; title: string; description: string; sortOrder: number; done: boolean }>;
};
