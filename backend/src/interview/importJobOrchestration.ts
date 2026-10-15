import {
  extractBankQuestions,
  needsLlmQuestionExtraction,
  type ImportJobKind
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type {
  InterviewImportJobRecord,
  InterviewKnowledgeDoc,
  InterviewPrepRepository
} from "../interviewPrepRepository.js";
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

export interface ImportJobOrchestrationDeps {
  repository: InterviewPrepRepository;
  llmClient: LlmClient;
  cancellationRegistry: JobCancellationRegistry;
}

export function shouldQueueQuestionImport(doc: InterviewKnowledgeDoc, extractedCount: number): boolean {
  return needsLlmQuestionExtraction(doc.content.length, extractedCount, MAX_MODEL_CHARS);
}

export function buildProcessDeps(deps: ImportJobOrchestrationDeps): ProcessImportJobDeps {
  return {
    llmClient: deps.llmClient,
    repository: deps.repository,
    cancellationRegistry: deps.cancellationRegistry,
    onQuestionsImported: (userId, knowledgeDocId) => {
      void queueQuestionCleanup(deps, userId, [knowledgeDocId]);
    }
  };
}

const cleanupChains = new Map<string, Promise<void>>();

/**
 * Run cleanup work for one user strictly one after another (in-process).
 * Avoids many parallel LLM calls on "clean all" and keeps the duplicate check race-free.
 */
export function runCleanupSerial(userId: string, task: () => Promise<void>): Promise<void> {
  const previous = cleanupChains.get(userId) ?? Promise.resolve();
  const next: Promise<void> = previous
    .then(task, task)
    .catch(() => undefined)
    .finally(() => {
      if (cleanupChains.get(userId) === next) cleanupChains.delete(userId);
    });
  cleanupChains.set(userId, next);
  return next;
}

/** Resolves when all cleanup work queued so far for the user has finished. */
export function whenCleanupIdle(userId: string): Promise<void> {
  return cleanupChains.get(userId) ?? Promise.resolve();
}

/** Start processing a queued job. Cleanup jobs go through the per-user serial runner. */
export function startImportJob(
  deps: ImportJobOrchestrationDeps,
  userId: string,
  job: Pick<InterviewImportJobRecord, "id" | "kind">
): void {
  const processDeps = buildProcessDeps(deps);
  if (job.kind === "questions_cleanup") {
    void runCleanupSerial(userId, () => processImportJob(processDeps, userId, job.id));
    return;
  }
  void processImportJob(processDeps, userId, job.id);
}

export async function ensureImportJob(
  deps: ImportJobOrchestrationDeps,
  userId: string,
  knowledgeDocId: string,
  kind: ImportJobKind
): Promise<InterviewImportJobDto | null> {
  const existing = await deps.repository.listImportJobsForDoc(userId, knowledgeDocId, kind);
  if (hasCompletedImportJob(existing, kind) || hasActiveImportJob(existing, kind)) {
    return null;
  }
  const job = await deps.repository.createImportJob(userId, { knowledgeDocId, kind });
  startImportJob(deps, userId, job);
  return toImportJobDto(job);
}

/**
 * Queue the cleanup agent for documents that have active questions it has not reviewed.
 * Without `knowledgeDocIds`, every such document is queued. Does nothing when AI is not configured.
 */
export async function queueQuestionCleanup(
  deps: ImportJobOrchestrationDeps,
  userId: string,
  knowledgeDocIds?: string[]
): Promise<InterviewImportJobDto[]> {
  if (!deps.llmClient.isConfigured()) return [];
  const uncleaned = await deps.repository.listBankQuestions(userId, { status: "active", uncleaned: true });
  const pendingDocs = new Set(uncleaned.map((row) => row.knowledgeDocId));
  const docIds = [...new Set(knowledgeDocIds ?? pendingDocs)].filter((id) => pendingDocs.has(id));

  const queued: InterviewImportJobDto[] = [];
  for (const docId of docIds) {
    const jobs = await deps.repository.listImportJobsForDoc(userId, docId, "questions_cleanup");
    if (hasActiveImportJob(jobs, "questions_cleanup")) {
      // The running job may already have done its last fetch: check again once it is finished.
      void runCleanupSerial(userId, async () => {
        await queueQuestionCleanup(deps, userId, [docId]);
      });
      continue;
    }
    const reusable = jobs[0];
    const job = reusable
      ? await deps.repository.updateImportJob(userId, reusable.id, {
          status: "queued",
          progress: 0,
          message: "Venter på opprydding…",
          resultJson: "[]"
        })
      : await deps.repository.createImportJob(userId, { knowledgeDocId: docId, kind: "questions_cleanup" });
    if (!job) continue;
    startImportJob(deps, userId, job);
    queued.push(toImportJobDto(job));
  }
  return queued;
}

export async function queueQuestionImportsForSparseDocs(
  deps: ImportJobOrchestrationDeps,
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
