import { PrismaClient } from "@prisma/client";
import type {
  CaseSourceKind,
  CaseStyle,
  InterviewMode,
  KnowledgeDocKind,
  PrepFormat,
  PrepPlanStatus,
  QuestionCategory,
  QuestionTarget
} from "@careercenter/shared";
import type {
  CaseEntryInput,
  InterviewCaseEntryRecord,
  InterviewKnowledgeDoc,
  InterviewMessageRecord,
  InterviewPrepPlanRecord,
  InterviewPrepRepository,
  InterviewSessionRecord,
  InterviewSimulatorSettingsRecord,
  KnowledgeDocInput,
  PrepPlanCreateInput
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

  async listCaseEntries(userId: string): Promise<InterviewCaseEntryRecord[]> {
    const rows = await this.prisma.interviewCaseEntry.findMany({
      where: { userId },
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
        contentHash: input.contentHash
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
        contentHash: input.contentHash
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
    input: { researchNotes: string; clarifications: Array<{ question: string; sortOrder: number }> }
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.interviewPrepClarification.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlan.update({
        where: { id },
        data: {
          researchNotes: input.researchNotes,
          clarifications: {
            create: input.clarifications.map((item) => ({
              question: item.question,
              sortOrder: item.sortOrder
            }))
          }
        }
      })
    ]);
    return this.getPrepPlan(userId, id);
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
      questions: Array<{ text: string; category: QuestionCategory; target: QuestionTarget }>;
      tasks: Array<{ title: string; description: string }>;
    }
  ): Promise<InterviewPrepPlanRecord | null> {
    const existing = await this.prisma.interviewPrepPlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await this.prisma.$transaction([
      this.prisma.interviewPrepQuestion.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepTask.deleteMany({ where: { planId: id } }),
      this.prisma.interviewPrepPlan.update({
        where: { id },
        data: {
          questions: {
            create: input.questions.map((item, index) => ({
              text: item.text,
              category: item.category,
              target: item.target,
              sortOrder: index
            }))
          },
          tasks: {
            create: input.tasks.map((item, index) => ({
              title: item.title,
              description: item.description,
              sortOrder: index
            }))
          }
        }
      })
    ]);
    return this.getPrepPlan(userId, id);
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
    input: { mode: InterviewMode; title: string; prepPlanId?: string; systemPrompt: string }
  ): Promise<InterviewSessionRecord> {
    const row = await this.prisma.interviewSession.create({
      data: {
        userId,
        mode: input.mode,
        title: input.title,
        prepPlanId: input.prepPlanId,
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
    const row = await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        feedbackJson: JSON.stringify(feedback),
        finishedAt: new Date()
      }
    });
    return this.mapSession(row);
  }

  private mapKnowledge(row: {
    id: string;
    userId: string;
    kind: string;
    title: string;
    content: string;
    sourceFilename: string | null;
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
      contentHash: row.contentHash,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
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
}

const planIncludes = {
  clarifications: true,
  questions: true,
  tasks: true
} as const;

type PlanRow = {
  id: string;
  userId: string;
  companyName: string;
  roleTitle: string;
  format: string;
  status: string;
  researchNotes: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  clarifications: Array<{ id: string; question: string; answer: string; sortOrder: number }>;
  questions: Array<{ id: string; text: string; category: string; target: string; sortOrder: number }>;
  tasks: Array<{ id: string; title: string; description: string; sortOrder: number; done: boolean }>;
};
