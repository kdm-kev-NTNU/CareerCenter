import {
  categoryForAudience,
  classifyCaseSource,
  normalizeQuestionKey,
  type CaseSourceKind,
  type ImportJobKind,
  type ImportJobStatus
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { BankQuestionInput, InterviewPrepRepository } from "../interviewPrepRepository.js";
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
import {
  JobCancellationRegistry,
  USER_CANCEL_MESSAGE
} from "./jobCancellationRegistry.js";
import { bankQuestionExtractSchema, caseSpanExtractSchema, exhibitPromptSchema } from "./knowledgeSchemas.js";
import { processQuestionCleanup } from "./questionCleanup.js";
import { audienceDefinitions, categoryDefinitions } from "./questionTaxonomyPrompt.js";

export interface ProcessImportJobDeps {
  llmClient: LlmClient;
  repository: InterviewPrepRepository;
  cancellationRegistry: JobCancellationRegistry;
  /** Called when an LLM question import finishes, so the new rows get cleaned up. */
  onQuestionsImported?: (userId: string, knowledgeDocId: string) => void;
}

const START_MESSAGES: Record<ImportJobKind, string> = {
  cases: "Segmenterer dokument…",
  questions: "Trekker ut spørsmål…",
  questions_cleanup: "Rydder spørsmål…"
};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: string }).name === "AbortError")
  );
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error(USER_CANCEL_MESSAGE);
    error.name = "AbortError";
    throw error;
  }
}

export async function processImportJob(
  deps: ProcessImportJobDeps,
  userId: string,
  jobId: string
): Promise<void> {
  const key = JobCancellationRegistry.importKey(jobId);
  const signal = deps.cancellationRegistry.begin(key);
  try {
    const job = await deps.repository.getImportJob(userId, jobId);
    if (!job) return;
    if (job.status === "cancelled") return;

    await deps.repository.updateImportJob(userId, jobId, {
      status: "running",
      progress: 10,
      message: START_MESSAGES[job.kind]
    });

    const docs = await deps.repository.listKnowledgeDocs(userId);
    const doc = docs.find((d) => d.id === job.knowledgeDocId);
    if (!doc) throw new Error("Kunnskapsdokument ikke funnet.");

    if (job.kind === "questions") {
      await processQuestionImport(deps, userId, jobId, doc.id, doc.kind, doc.title, doc.content, signal);
      return;
    }

    if (job.kind === "questions_cleanup") {
      await processQuestionCleanup(deps, userId, jobId, doc, signal);
      return;
    }

    const sourceKind = classifyCaseSource({
      filename: doc.sourceFilename ?? doc.title,
      title: doc.title,
      content: doc.content
    });

    if (sourceKind === "exhibit_pack") {
      await processExhibitPack(
        deps,
        userId,
        jobId,
        doc.id,
        doc.title,
        doc.content,
        doc.originalFileKey,
        signal
      );
      return;
    }

    const state = parseImportJobState(job.resultJson) ?? {
      version: 2 as const,
      chunks: chunksFromSpans(proposeCaseSpans(doc.content))
    };
    if (state.chunks.length === 0) throw new Error("Ingen tekst å dele opp.");

    await persistState(deps, userId, jobId, state, "running", 0, "Deler opp dokumentet…");

    for (const chunk of state.chunks) {
      throwIfAborted(signal);
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
        await extractCaseChunk(deps, userId, doc.id, doc.content, doc.originalFileKey, chunk, signal);
        chunk.status = "done";
        chunk.error = undefined;
      } catch (error) {
        if (isAbortError(error)) throw error;
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
    if (isAbortError(error) || signal.aborted) {
      await deps.repository.updateImportJob(userId, jobId, {
        status: "cancelled",
        message: USER_CANCEL_MESSAGE
      });
      return;
    }
    const message = error instanceof Error ? error.message : "Importjobb feilet.";
    await deps.repository.updateImportJob(userId, jobId, {
      status: "failed",
      progress: 100,
      message
    });
  } finally {
    deps.cancellationRegistry.end(key);
  }
}

export async function cancelImportJob(
  deps: Pick<ProcessImportJobDeps, "repository" | "cancellationRegistry">,
  userId: string,
  jobId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const job = await deps.repository.getImportJob(userId, jobId);
  if (!job) return { ok: false, status: 404, message: "Jobb ikke funnet." };
  if (job.status !== "queued" && job.status !== "running") {
    return { ok: false, status: 409, message: "Jobben kan bare stoppes mens den kjører." };
  }
  const aborted = deps.cancellationRegistry.abort(JobCancellationRegistry.importKey(jobId));
  if (!aborted && job.status === "queued") {
    await deps.repository.updateImportJob(userId, jobId, {
      status: "cancelled",
      message: USER_CANCEL_MESSAGE
    });
  } else if (!aborted) {
    await deps.repository.updateImportJob(userId, jobId, {
      status: "cancelled",
      message: USER_CANCEL_MESSAGE
    });
  }
  return { ok: true };
}

async function persistState(
  deps: Pick<ProcessImportJobDeps, "repository">,
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

async function processQuestionImport(
  deps: ProcessImportJobDeps,
  userId: string,
  jobId: string,
  knowledgeDocId: string,
  kind: string,
  title: string,
  content: string,
  signal: AbortSignal
): Promise<void> {
  const job = await deps.repository.getImportJob(userId, jobId);
  const state = parseImportJobState(job?.resultJson ?? "[]") ?? {
    version: 2 as const,
    chunks: chunksFromSpans(proposeCaseSpans(content))
  };
  if (state.chunks.length === 0) {
    state.chunks = [
      {
        index: 0,
        title,
        fileName: title,
        pageStart: 1,
        pageEnd: 1,
        uncertain: true,
        status: "pending"
      }
    ];
  }

  await persistState(deps, userId, jobId, state, "running", 0, "Trekker ut spørsmål…");

  let insertedTotal = 0;
  for (const chunk of state.chunks) {
    throwIfAborted(signal);
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
      insertedTotal += await extractQuestionChunk(
        deps,
        userId,
        knowledgeDocId,
        kind,
        title,
        content,
        chunk,
        signal
      );
      chunk.status = "done";
      chunk.error = undefined;
    } catch (error) {
      if (isAbortError(error)) throw error;
      chunk.status = "failed";
      chunk.error = error instanceof Error ? error.message : "Spørsmålsuttrekk feilet.";
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

  await persistState(
    deps,
    userId,
    jobId,
    state,
    "done",
    100,
    `${insertedTotal} nye spørsmål indeksert`
  );
  deps.onQuestionsImported?.(userId, knowledgeDocId);
}

export function buildQuestionExtractSystemPrompt(): string {
  return [
    "Du trekker ut spørsmål fra et dokument om intervjuforberedelse. Returner hvert spørsmål som et eget element med text, audience og category.",
    "Ta med spørsmål en intervjuer kan stille kandidaten, og spørsmål kandidaten kan stille intervjueren.",
    "Ikke ta med: instrukser til intervjueren eller øvingspartneren, tips og råd, svarmaler og standardsvar, e-postmaler, utfyllingsfelt, eller spørsmål kandidaten skal reflektere over alene.",
    "Returner bare selve spørsmålet: fjern innledninger som «Spørsmålet om X stiller du slik:», punkttegn og anførselstegn. Behold ordlyden ellers.",
    "Ikke lag case-prompts eller oppgaver uten spørsmålstegn.",
    "",
    ...audienceDefinitions,
    "",
    ...categoryDefinitions
  ].join("\n");
}

async function extractQuestionChunk(
  deps: ProcessImportJobDeps,
  userId: string,
  knowledgeDocId: string,
  kind: string,
  title: string,
  content: string,
  chunk: ImportChunkState,
  signal: AbortSignal
): Promise<number> {
  const sections = parseDocuments(content);
  const section = sections.find((item) => item.fileName === chunk.fileName) ?? sections[0];
  const text = section
    ? spanText(section.pages, chunk.pageStart, chunk.pageEnd)
    : content.slice(0, 12_000);
  if (!text.trim()) throw new Error("Delen har ingen tekst.");

  const extracted = await deps.llmClient.completeStructured(
    {
      signal,
      messages: [
        { role: "system", content: buildQuestionExtractSystemPrompt() },
        {
          role: "user",
          content: `Dokument: ${title}\nDel: ${chunk.title}\n\n${text}`
        }
      ]
    },
    bankQuestionExtractSchema
  );

  // Skip questions the document already has (rule-based or earlier chunks), by normalized text.
  const existing = await deps.repository.listBankQuestions(userId, { knowledgeDocId, status: "all" });
  const seen = new Set(
    existing.flatMap((row) => [normalizeQuestionKey(row.text), normalizeQuestionKey(row.sourceText)])
  );
  const questions: BankQuestionInput[] = [];
  for (const item of extracted.questions) {
    const textValue = item.text.trim();
    if (textValue.length < 8 || !textValue.endsWith("?")) continue;
    const key = normalizeQuestionKey(textValue);
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({
      text: textValue,
      category: categoryForAudience(item.audience, item.category),
      audience: item.audience,
      tags: [kind, "llm"],
      origin: "llm",
      contentHash: sha256Content(`bank:v2:${knowledgeDocId}:llm:${key}`)
    });
  }

  return deps.repository.insertBankQuestions(userId, knowledgeDocId, questions);
}

async function extractCaseChunk(
  deps: ProcessImportJobDeps,
  userId: string,
  knowledgeDocId: string,
  content: string,
  originalFileKey: string | undefined,
  chunk: ImportChunkState,
  signal: AbortSignal
): Promise<void> {
  const sections = parseDocuments(content);
  const section = sections.find((item) => item.fileName === chunk.fileName) ?? sections[0];
  if (!section) throw new Error("Fant ikke sidene for denne delen.");
  const text = spanText(section.pages, chunk.pageStart, chunk.pageEnd);
  if (!text.trim()) throw new Error("Delen har ingen tekst.");

  const extracted = await deps.llmClient.completeStructured(
    {
      signal,
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
  deps: ProcessImportJobDeps,
  userId: string,
  jobId: string,
  knowledgeDocId: string,
  title: string,
  content: string,
  originalFileKey: string | undefined,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const generated = await deps.llmClient.completeStructured(
    {
      signal,
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

export function hasCompletedImportJob(
  jobs: Array<{ kind: ImportJobKind; status: ImportJobStatus }>,
  kind: ImportJobKind
): boolean {
  return jobs.some(
    (job) => job.kind === kind && (job.status === "done" || job.status === "review")
  );
}

export function hasActiveImportJob(
  jobs: Array<{ kind: ImportJobKind; status: ImportJobStatus }>,
  kind: ImportJobKind
): boolean {
  return jobs.some(
    (job) => job.kind === kind && (job.status === "queued" || job.status === "running")
  );
}
