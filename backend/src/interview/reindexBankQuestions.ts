import { extractBankQuestions, normalizeQuestionKey, type ExtractedBankQuestion } from "@careercenter/shared";
import { sha256Content } from "./contentHash.js";
import type {
  BankQuestionInput,
  InterviewBankQuestionRecord,
  InterviewPrepRepository
} from "../interviewPrepRepository.js";

export interface ReindexResult {
  inserted: number;
  removed: number;
}

export function bankQuestionHash(knowledgeDocId: string, key: string): string {
  return sha256Content(`bank:v2:${knowledgeDocId}:${key}`);
}

/**
 * Diff rule-based extraction against the rows a document already has.
 * Identity is the source sentence (not the current text), so rows the cleanup agent
 * rewrote or discarded survive, and discarded rows are not inserted again.
 * Manual and LLM rows are never removed.
 */
export function planRuleReindex(
  knowledgeDocId: string,
  existing: Array<Pick<InterviewBankQuestionRecord, "id" | "origin" | "sourceText">>,
  extracted: ExtractedBankQuestion[]
): { toInsert: BankQuestionInput[]; toDeleteIds: string[] } {
  const extractedByKey = new Map<string, ExtractedBankQuestion>();
  for (const item of extracted) {
    const key = normalizeQuestionKey(item.text);
    if (!extractedByKey.has(key)) extractedByKey.set(key, item);
  }
  const existingKeys = new Set(existing.map((row) => normalizeQuestionKey(row.sourceText)));

  const toInsert: BankQuestionInput[] = [...extractedByKey]
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, item]) => ({
      text: item.text,
      category: item.category,
      audience: "candidate",
      tags: item.tags,
      origin: "rule",
      sourceText: item.text,
      contentHash: bankQuestionHash(knowledgeDocId, key)
    }));

  const toDeleteIds = existing
    .filter(
      (row) =>
        (row.origin === "rule" || row.origin === "split") &&
        !extractedByKey.has(normalizeQuestionKey(row.sourceText))
    )
    .map((row) => row.id);

  return { toInsert, toDeleteIds };
}

export async function reindexBankQuestionsForDoc(
  repository: InterviewPrepRepository,
  userId: string,
  knowledgeDocId: string
): Promise<ReindexResult> {
  const docs = await repository.listKnowledgeDocs(userId);
  const doc = docs.find((item) => item.id === knowledgeDocId);
  if (!doc) return { inserted: 0, removed: 0 };
  const extracted = extractBankQuestions({
    kind: doc.kind,
    title: doc.title,
    content: doc.content
  });
  const existing = await repository.listBankQuestions(userId, { knowledgeDocId, status: "all" });
  const { toInsert, toDeleteIds } = planRuleReindex(knowledgeDocId, existing, extracted);
  const removed = await repository.deleteBankQuestions(userId, toDeleteIds);
  const inserted = await repository.insertBankQuestions(userId, knowledgeDocId, toInsert);
  return { inserted, removed };
}

export async function reindexAllBankQuestions(
  repository: InterviewPrepRepository,
  userId: string
): Promise<ReindexResult> {
  const docs = await repository.listKnowledgeDocs(userId);
  const total: ReindexResult = { inserted: 0, removed: 0 };
  for (const doc of docs) {
    const result = await reindexBankQuestionsForDoc(repository, userId, doc.id);
    total.inserted += result.inserted;
    total.removed += result.removed;
  }
  return total;
}
