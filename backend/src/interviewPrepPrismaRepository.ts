import { PrismaClient } from "@prisma/client";
import type { KnowledgeDocKind } from "@careercenter/shared";
import type { InterviewKnowledgeDoc, InterviewPrepRepository } from "./interviewPrepRepository.js";

export class InterviewPrepPrismaRepository implements InterviewPrepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]> {
    const rows = await this.prisma.interviewKnowledgeDoc.findMany({
      where: { userId },
      orderBy: { title: "asc" }
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      kind: row.kind as KnowledgeDocKind,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }
}
