import { classifyCaseSource, type CaseSourceKind, type ImportJobStatus } from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import { proposeCaseSpans } from "./caseSpans.js";
import { sha256Content } from "./contentHash.js";
import { parseDocuments, spanText } from "./documentPages.js";
import {
  chunkProgressMessage,
  chunksFromSpans,
  parseImportJobState,
  serializeImportJobState,
  type ImportChunkState,
  type ImportJobState
} from "./importJobState.js";
import { caseSpanExtractSchema, exhibitPromptSchema } from "./knowledgeSchemas.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

const queue: Array<{ userId: string; jobId: string }> = [];
let draining = false;

export function enqueueImportJob(userId: string, jobId: string): void {
  queue.push({ userId, jobId });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    // processed by caller-bound runner via processImportJob
  }
  draining = false;
}

export async function processImportJob(
  deps: { llmClient: LlmClient; repository: InterviewPrepRepository },
  userId: string,
  jobId: string
): Promise<void> {
  const job = await deps.repository.getImportJob(userId, jobId);
  if (!job) return;

  await deps.repository.updateImportJob(userId, jobId, {
    status: "running",
    progress: 10,
    message: "Segmenterer dokument…"
  });

  try {
    const docs = await deps.repository.listKnowledgeDocs(userId);
    const doc = docs.find((d) => d.id === job.knowledgeDocId);
    if (!doc) throw new Error("Kunnskapsdokument ikke funnet.");

    const sourceKind = classifyCaseSource({
      filename: doc.sourceFilename ?? doc.title,
      title: doc.title,
      content: doc.content
    });

    if (sourceKind === "exhibit_pack") {
      await processExhibitPack(deps, userId, jobId, doc.id, doc.title, doc.content, doc.originalFileKey);
      return;
    }

    const state = parseImportJobState(job.resultJson) ?? {
      version: 2 as const,
      chunks: chunksFromSpans(proposeCaseSpans(doc.content))
    };
    if (state.chunks.length === 0) throw new Error("Ingen tekst å dele opp.");

    await persistState(deps, userId, jobId, state, "running", 0, "Deler opp dokumentet…");

    for (const chunk of state.chunks) {
      if (chunk.status === "done") continue;
      const done = state.chunks.filter((item) => item.status === "done").length;
      await persistState(
        deps,
        userId,
        jobId,
        state,
        "running",
        progressFor(done, state.chunks.length),
        chunkProgressMessage(state.chunks, chunk)
      );
      try {
        await extractChunk(deps, userId, doc.id, doc.content, doc.originalFileKey, chunk);
        chunk.status = "done";
        chunk.error = undefined;
      } catch (error) {
        chunk.status = "failed";
        chunk.error = error instanceof Error ? error.message : "Uttrekk feilet.";
      }
      await persistState(
        deps,
        userId,
        jobId,
        state,
        "running",
        progressFor(
          state.chunks.filter((item) => item.status === "done").length,
          state.chunks.length
        ),
        chunkProgressMessage(state.chunks, chunk)
      );
    }

    const failed = state.chunks.filter((chunk) => chunk.status === "failed");
    const done = state.chunks.filter((chunk) => chunk.status === "done").length;
    if (failed.length > 0) {
      await persistState(
        deps,
        userId,
        jobId,
        state,
        "failed",
        progressFor(done, state.chunks.length),
        `${failed.length} av ${state.chunks.length} feilet: ${failed[0]?.error ?? "ukjent feil"}`
      );
      return;
    }

    await persistState(deps, userId, jobId, state, "done", 100, `${done} caseutkast klare for gjennomgang`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Importjobb feilet.";
    await deps.repository.updateImportJob(userId, jobId, {
      status: "failed",
      progress: 100,
      message
    });
  }
}

async function persistState(
  deps: { repository: InterviewPrepRepository },
  userId: string,
  jobId: string,
  state: ImportJobState,
  status: ImportJobStatus,
  progress: number,
  message: string
): Promise<void> {
  await deps.repository.updateImportJob(userId, jobId, {
    status,
    progress,
    message,
    resultJson: serializeImportJobState(state)
  });
}

function progressFor(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

async function extractChunk(
  deps: { llmClient: LlmClient; repository: InterviewPrepRepository },
  userId: string,
  knowledgeDocId: string,
  content: string,
  originalFileKey: string | undefined,
  chunk: ImportChunkState
): Promise<void> {
  const sections = parseDocuments(content);
  const section = sections.find((item) => item.fileName === chunk.fileName) ?? sections[0];
  if (!section) throw new Error("Fant ikke sidene for denne delen.");
  const text = spanText(section.pages, chunk.pageStart, chunk.pageEnd);
  if (!text.trim()) throw new Error("Delen har ingen tekst.");

  const extracted = await deps.llmClient.completeStructured(
    {
      messages: [
        {
          role: "system",
          content:
            "Du trekker ut én case fra teksten. Returner title, prompt, interviewerInfo og solution for denne delen alene. Ikke finn opp andre caser."
        },
        {
          role: "user",
          content: `Tittelhint: ${chunk.title}\nSider: ${chunk.pageStart}–${chunk.pageEnd}\n\n${text}`
        }
      ]
    },
    caseSpanExtractSchema
  );
  if (!extracted.title.trim() || !extracted.prompt.trim()) {
    throw new Error("Uttrekket mangler tittel eller prompt.");
  }

  const contentHash = sha256Content(`${extracted.title}:${extracted.prompt}:${extracted.solution}`);
  const existing = await deps.repository.findCaseByHash(userId, contentHash);
  if (existing) return;
  await deps.repository.createCaseEntry(userId, {
    title: extracted.title,
    prompt: extracted.prompt,
    interviewerInfo: extracted.interviewerInfo,
    solution: extracted.solution,
    sourceKind: "casebook" satisfies CaseSourceKind,
    companyTags: [],
    knowledgeDocId,
    contentHash,
    approvalStatus: "pending",
    originalFileKey
  });
}

async function processExhibitPack(
  deps: { llmClient: LlmClient; repository: InterviewPrepRepository },
  userId: string,
  jobId: string,
  knowledgeDocId: string,
  title: string,
  content: string,
  originalFileKey?: string
): Promise<void> {
  const generated = await deps.llmClient.completeStructured(
    {
      messages: [
        {
          role: "system",
          content: "Lag en case-prompt basert på exhibit-pakken. Marker at prompten må godkjennes."
        },
        { role: "user", content: content.slice(0, 40_000) }
      ]
    },
    exhibitPromptSchema
  );

  const contentHash = sha256Content(`${generated.title}:${generated.prompt}:exhibit`);
  const existing = await deps.repository.findCaseByHash(userId, contentHash);
  if (!existing) {
    await deps.repository.createCaseEntry(userId, {
      title: generated.title || title,
      prompt: generated.prompt,
      interviewerInfo: generated.interviewerInfo,
      solution: generated.solution,
      sourceKind: "exhibit_pack",
      companyTags: [],
      knowledgeDocId,
      contentHash,
      approvalStatus: "pending",
      originalFileKey
    });
  }

  await deps.repository.updateImportJob(userId, jobId, {
    status: "review",
    progress: 100,
    message: "Exhibit-prompt venter på godkjenning",
    resultJson: JSON.stringify([generated])
  });
}
