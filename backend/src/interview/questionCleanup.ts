import { categoryForAudience, normalizeQuestionKey } from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type {
  BankQuestionInput,
  InterviewBankQuestionRecord,
  InterviewKnowledgeDoc,
  InterviewPrepRepository
} from "../interviewPrepRepository.js";
import { sha256Content } from "./contentHash.js";
import { USER_CANCEL_MESSAGE } from "./jobCancellationRegistry.js";
import { questionCleanupResultSchema, type QuestionCleanupResult } from "./knowledgeSchemas.js";
import { buildDocContextIndex, questionContext, type QuestionContext } from "./questionContext.js";
import { audienceDefinitions, categoryDefinitions, nonQuestionDefinitions } from "./questionTaxonomyPrompt.js";

/** Questions per LLM call. */
export const CLEANUP_BATCH_SIZE = 30;

export interface QuestionCleanupDeps {
  llmClient: LlmClient;
  repository: InterviewPrepRepository;
}

export interface CleanupTotals {
  kept: number;
  rewritten: number;
  split: number;
  discarded: number;
  duplicates: number;
  /** Rows the model did not return; they stay uncleaned and are retried next run. */
  skipped: number;
}

export function emptyCleanupTotals(): CleanupTotals {
  return { kept: 0, rewritten: 0, split: 0, discarded: 0, duplicates: 0, skipped: 0 };
}

/** Normalized question text → id of the active, cleaned row that owns it. */
export type ActiveQuestionKeys = Map<string, string>;

type CleanupItem = QuestionCleanupResult["items"][number];
type CleanupPart = CleanupItem["parts"][number];

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

export function buildQuestionCleanupSystemPrompt(): string {
  return [
    "Du er redaktør for en spørsmålsbank til intervjuøving. Spørsmålene er trukket automatisk ut av kandidatens egne notater (alle setninger som slutter med «?»), så mange står feil eller er ikke spørsmål i det hele tatt.",
    "Du får dokumentets tittel og type, og for hvert spørsmål id, tekst, nærmeste overskrift og et utdrag rundt teksten. Returner nøyaktig ett element per id, i samme rekkefølge.",
    "",
    ...audienceDefinitions,
    "",
    ...categoryDefinitions,
    "",
    "Handling (action):",
    "- keep: et ekte, selvstendig spørsmål. parts har ett element med uendret tekst og riktig audience og category.",
    "- rewrite: et ekte spørsmål pakket inn i noe annet. Fjern innledning, instruks, punkttegn og anførselstegn, og returner bare selve spørsmålet, ordrett der det går. Eksempel: «Spørsmålet om gjennomtrekk stiller du slik: «Bransjen har rykte for at folk bytter ofte. Hva har gjort at du har blitt værende?» blir «Bransjen har rykte for at folk bytter ofte. Hva har gjort at du har blitt værende?» med audience ask_interviewer_personal. parts har ett element.",
    "- split: teksten inneholder flere selvstendige spørsmål som bør øves hver for seg. parts har ett element per spørsmål. Del bare når spørsmålene er uavhengige. Et oppfølgingsledd som hører til samme spørsmål blir værende: «Hvordan håndterer du tilbakemeldinger? Gi et eksempel på en gang du implementerte en tilbakemelding.» er ETT spørsmål.",
    "- discard: ikke et spørsmål noen stiller i et intervju. parts er tom, og discardReason er satt.",
    "Sett discardReason til null for alle andre handlinger.",
    "",
    ...nonQuestionDefinitions,
    "",
    "Regler:",
    "- Ikke finn på nye spørsmål, og ikke pynt på ordlyden utover å fjerne det som ikke hører til. Behold språket (norsk eller engelsk).",
    "- Et spørsmål i en liste med «Ser etter»/«Vinkling», eller i en spørsmålsbank intervjueren skal bruke, er et ekte candidate-spørsmål. Det samme spørsmålet inne i en instruks om hvordan intervjueren skal oppføre seg er en instruks.",
    "- Er du i tvil mellom keep og discard, velg keep.",
    "- Returner hver id nøyaktig én gang."
  ].join("\n");
}

export function buildQuestionCleanupUserMessage(
  doc: Pick<InterviewKnowledgeDoc, "title" | "kind">,
  batch: Array<{ row: InterviewBankQuestionRecord; context: QuestionContext }>
): string {
  const blocks = batch.map(({ row, context }) =>
    [
      "---",
      `id: ${row.id}`,
      `tekst: ${row.text}`,
      `overskrift: ${context.heading || "–"}`,
      `underoverskrift: ${context.subheading || "–"}`,
      `utdrag: ${context.excerpt || "–"}`
    ].join("\n")
  );
  return [`Dokument: «${doc.title}» (type: ${doc.kind})`, "", ...blocks].join("\n");
}

/** Trim, collapse whitespace and strip surrounding quotes. Returns null for text too short to be a question. */
function sanitizeQuestionText(value: string): string | null {
  const text = value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[«"“]+/, "")
    .replace(/[»"”]+$/, "")
    .trim();
  return text.length >= 8 ? text : null;
}

/** The key is free, or already owned by this row. */
function canClaim(activeKeys: ActiveQuestionKeys, key: string, id: string): boolean {
  const owner = activeKeys.get(key);
  return owner === undefined || owner === id;
}

/**
 * Apply the model's decisions to one batch. Rows keep their id (plan links survive);
 * split children are inserted before the parent is marked cleaned, so a crash cannot
 * duplicate them on the next run.
 */
export async function applyQuestionCleanup(
  repository: InterviewPrepRepository,
  userId: string,
  rows: InterviewBankQuestionRecord[],
  result: QuestionCleanupResult,
  activeKeys: ActiveQuestionKeys,
  totals: CleanupTotals
): Promise<void> {
  const byId = new Map<string, CleanupItem>();
  for (const item of result.items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const now = new Date().toISOString();

  const discard = async (row: InterviewBankQuestionRecord, reason: NonNullable<CleanupItem["discardReason"]>) => {
    await repository.updateBankQuestion(userId, row.id, { status: "discarded", discardReason: reason, cleanedAt: now });
    if (reason === "duplikat") totals.duplicates += 1;
    else totals.discarded += 1;
  };

  const keep = async (row: InterviewBankQuestionRecord, part: CleanupPart | undefined) => {
    const key = normalizeQuestionKey(row.text);
    if (!canClaim(activeKeys, key, row.id)) {
      await discard(row, "duplikat");
      return;
    }
    const audience = part?.audience ?? row.audience;
    await repository.updateBankQuestion(userId, row.id, {
      audience,
      category: categoryForAudience(audience, part?.category ?? row.category),
      cleanedAt: now
    });
    activeKeys.set(key, row.id);
    totals.kept += 1;
  };

  for (const row of rows) {
    const item = byId.get(row.id);
    if (!item) {
      totals.skipped += 1;
      continue;
    }

    if (item.action === "discard") {
      await discard(row, item.discardReason ?? "ikke_sporsmal");
      continue;
    }

    if (item.action === "keep") {
      await keep(row, item.parts[0]);
      continue;
    }

    const seen = new Set<string>();
    const valid: Array<{ part: CleanupPart; text: string; key: string }> = [];
    for (const part of item.parts) {
      const text = sanitizeQuestionText(part.text);
      if (!text) continue;
      const key = normalizeQuestionKey(text);
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push({ part, text, key });
    }
    if (valid.length === 0) {
      await keep(row, item.parts[0]);
      continue;
    }
    const claimable = valid.filter((entry) => canClaim(activeKeys, entry.key, row.id));
    if (claimable.length === 0) {
      await discard(row, "duplikat");
      continue;
    }

    const [first, ...rest] = item.action === "split" ? claimable : claimable.slice(0, 1);
    if (rest.length > 0) {
      const children: BankQuestionInput[] = rest.map((entry) => ({
        text: entry.text,
        category: categoryForAudience(entry.part.audience, entry.part.category),
        audience: entry.part.audience,
        tags: row.tags,
        origin: "split",
        sourceText: row.sourceText,
        cleanedAt: now,
        contentHash: sha256Content(`split:${row.id}:${entry.key}`)
      }));
      await repository.insertBankQuestions(userId, row.knowledgeDocId, children);
      for (const entry of rest) activeKeys.set(entry.key, `split:${row.id}:${entry.key}`);
    }

    await repository.updateBankQuestion(userId, row.id, {
      text: first!.text,
      audience: first!.part.audience,
      category: categoryForAudience(first!.part.audience, first!.part.category),
      cleanedAt: now
    });
    activeKeys.set(first!.key, row.id);
    if (rest.length > 0) totals.split += 1;
    else if (first!.text !== row.text) totals.rewritten += 1;
    else totals.kept += 1;
  }
}

/** Keys of every active question that is already cleaned, across all the user's documents. */
export async function loadActiveQuestionKeys(
  repository: InterviewPrepRepository,
  userId: string
): Promise<ActiveQuestionKeys> {
  const rows = await repository.listBankQuestions(userId, { status: "active" });
  const keys: ActiveQuestionKeys = new Map();
  for (const row of rows) {
    if (!row.cleanedAt) continue;
    const key = normalizeQuestionKey(row.text);
    if (!keys.has(key)) keys.set(key, row.id);
  }
  return keys;
}

function progressMessage(done: number, total: number, totals: CleanupTotals): string {
  const removed = totals.discarded + totals.duplicates;
  const changed = totals.rewritten + totals.split;
  return `Rydder spørsmål: ${done} av ${total}. ${removed} forkastet, ${changed} omskrevet/delt.`;
}

function summaryMessage(totals: CleanupTotals): string {
  const removed = totals.discarded + totals.duplicates;
  const changed = totals.rewritten + totals.split;
  const reviewed = totals.kept + changed + removed;
  return `${reviewed} spørsmål ryddet: ${removed} forkastet, ${changed} omskrevet/delt.`;
}

function byPosition(a: { context: QuestionContext }, b: { context: QuestionContext }): number {
  const pa = a.context.position;
  const pb = b.context.position;
  if (pa === pb) return 0;
  if (!Number.isFinite(pa)) return 1;
  if (!Number.isFinite(pb)) return -1;
  return pa - pb;
}

/**
 * Cleanup job body for one knowledge document. Processes active questions that are not
 * cleaned yet: a deterministic duplicate pass first, then LLM batches. Re-fetches until no
 * uncleaned rows remain, so rows inserted while the job runs are included.
 */
export async function processQuestionCleanup(
  deps: QuestionCleanupDeps,
  userId: string,
  jobId: string,
  doc: InterviewKnowledgeDoc,
  signal: AbortSignal
): Promise<void> {
  const { repository } = deps;
  const index = buildDocContextIndex(doc.content);
  const attempted = new Set<string>();
  const totals = emptyCleanupTotals();
  const activeKeys = await loadActiveQuestionKeys(repository, userId);
  let failedRows = 0;
  let lastError = "";

  const fetchPending = async () =>
    (await repository.listBankQuestions(userId, { knowledgeDocId: doc.id, status: "active", uncleaned: true })).filter(
      (row) => !attempted.has(row.id)
    );

  let pending = await fetchPending();
  if (pending.length === 0) {
    await repository.updateImportJob(userId, jobId, {
      status: "done",
      progress: 100,
      message: "Ingen spørsmål å rydde.",
      resultJson: JSON.stringify({ version: 1, ...totals })
    });
    return;
  }
  let total = pending.length;

  while (pending.length > 0) {
    throwIfAborted(signal);
    const now = new Date().toISOString();
    const fresh: InterviewBankQuestionRecord[] = [];
    for (const row of pending) {
      const key = normalizeQuestionKey(row.text);
      if (!canClaim(activeKeys, key, row.id) || fresh.some((other) => normalizeQuestionKey(other.text) === key)) {
        await repository.updateBankQuestion(userId, row.id, {
          status: "discarded",
          discardReason: "duplikat",
          cleanedAt: now
        });
        totals.duplicates += 1;
        attempted.add(row.id);
        continue;
      }
      fresh.push(row);
    }

    const ordered = fresh
      .map((row) => ({ row, context: questionContext(index, row.sourceText) }))
      .sort(byPosition);

    for (let start = 0; start < ordered.length; start += CLEANUP_BATCH_SIZE) {
      throwIfAborted(signal);
      const batch = ordered.slice(start, start + CLEANUP_BATCH_SIZE);
      try {
        const result = await deps.llmClient.completeStructured(
          {
            signal,
            messages: [
              { role: "system", content: buildQuestionCleanupSystemPrompt() },
              { role: "user", content: buildQuestionCleanupUserMessage(doc, batch) }
            ]
          },
          questionCleanupResultSchema
        );
        await applyQuestionCleanup(
          repository,
          userId,
          batch.map((entry) => entry.row),
          result,
          activeKeys,
          totals
        );
      } catch (error) {
        if (isAbortError(error) || signal.aborted) throw error;
        failedRows += batch.length;
        lastError = error instanceof Error ? error.message : "Opprydding feilet.";
      }
      for (const entry of batch) attempted.add(entry.row.id);
      await repository.updateImportJob(userId, jobId, {
        status: "running",
        progress: Math.min(99, Math.round((attempted.size / Math.max(total, 1)) * 100)),
        message: progressMessage(attempted.size, total, totals)
      });
    }

    pending = await fetchPending();
    total = Math.max(total, attempted.size + pending.length);
  }

  const resultJson = JSON.stringify({ version: 1, ...totals });
  if (failedRows > 0) {
    await repository.updateImportJob(userId, jobId, {
      status: "failed",
      progress: Math.round(((attempted.size - failedRows) / Math.max(attempted.size, 1)) * 100),
      message: `${failedRows} spørsmål ble ikke ryddet: ${lastError}`,
      resultJson
    });
    return;
  }
  await repository.updateImportJob(userId, jobId, {
    status: "done",
    progress: 100,
    message: summaryMessage(totals),
    resultJson
  });
}
