import {
  extractBankQuestions,
  needsLlmQuestionExtraction,
  type ImportJobKind
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewKnowledgeDoc, InterviewPrepRepository } from "../interviewPrepRepository.js";
import { MAX_MODEL_CHARS } from "./documentPages.js";
import {
  hasActiveImportJob,
  hasCompletedImportJob,
  processImportJob,
  type ProcessImportJobDeps
} from "./importJobService.js";
import type { JobCancellationRegistry } from "./jobCancellationRegistry.js";
import { toImportJobDto } from "./dtoMappers.js";
import type { InterviewImportJobDto } from "@careercenter/shared";

export function shouldQueueQuestionImport(doc: InterviewKnowledgeDoc, extractedCount: number): boolean {
  return needsLlmQuestionExtraction(doc.content.length, extractedCount, MAX_MODEL_CHARS);
}

export async function ensureImportJob(
  deps: {
    repository: InterviewPrepRepository;
    llmClient: LlmClient;
    cancellationRegistry: JobCancellationRegistry;
  },
  userId: string,
  knowledgeDocId: string,
  kind: ImportJobKind
): Promise<InterviewImportJobDto | null> {
  const existing = await deps.repository.listImportJobsForDoc(userId, knowledgeDocId, kind);
  if (hasCompletedImportJob(existing, kind) || hasActiveImportJob(existing, kind)) {
    return null;
  }
  const job = await deps.repository.createImportJob(userId, { knowledgeDocId, kind });
  const processDeps: ProcessImportJobDeps = {
    llmClient: deps.llmClient,
    repository: deps.repository,
    cancellationRegistry: deps.cancellationRegistry
  };
  void processImportJob(processDeps, userId, job.id);
  return toImportJobDto(job);
}

export async function queueQuestionImportsForSparseDocs(
  deps: {
    repository: InterviewPrepRepository;
    llmClient: LlmClient;
    cancellationRegistry: JobCancellationRegistry;
  },
  userId: string
): Promise<number> {
  const docs = await deps.repository.listKnowledgeDocs(userId);
  let queued = 0;
  for (const doc of docs) {
    const extracted = extractBankQuestions({
      kind: doc.kind,
      title: doc.title,
      content: doc.content
    });
    if (!shouldQueueQuestionImport(doc, extracted.length)) continue;
    const job = await ensureImportJob(deps, userId, doc.id, "questions");
    if (job) queued += 1;
  }
  return queued;
}
