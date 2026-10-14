import type { InterviewKnowledgeDoc, InterviewPrepRepository } from "./interviewPrepRepository.js";

export class InterviewPrepMemoryRepository implements InterviewPrepRepository {
  private readonly knowledgeDocs = new Map<string, InterviewKnowledgeDoc>();

  async listKnowledgeDocs(userId: string): Promise<InterviewKnowledgeDoc[]> {
    return [...this.knowledgeDocs.values()]
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }
}
