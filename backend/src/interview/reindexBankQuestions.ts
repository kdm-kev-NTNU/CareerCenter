import { extractBankQuestions } from "@careercenter/shared";
import { sha256Content } from "./contentHash.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

export async function reindexBankQuestionsForDoc(
  repository: InterviewPrepRepository,
  userId: string,
  knowledgeDocId: string
): Promise<number> {
  const docs = await repository.listKnowledgeDocs(userId);
  const doc = docs.find((item) => item.id === knowledgeDocId);
  if (!doc) return 0;
  const extracted = extractBankQuestions({
    kind: doc.kind,
    title: doc.title,
    content: doc.content
  });
  await repository.replaceBankQuestionsForDoc(
    userId,
    knowledgeDocId,
    extracted.map((item) => ({
      text: item.text,
      category: item.category,
      tags: item.tags,
      contentHash: sha256Content(item.contentHashInput)
    }))
  );
  return extracted.length;
}

export async function reindexAllBankQuestions(
  repository: InterviewPrepRepository,
  userId: string
): Promise<number> {
  const docs = await repository.listKnowledgeDocs(userId);
  let total = 0;
  for (const doc of docs) {
    total += await reindexBankQuestionsForDoc(repository, userId, doc.id);
  }
  return total;
}
