import {
  MAX_CLARIFICATION_ROUNDS,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  canCancelPrepPlan,
  prepPlanResumePoint,
  rankBankQuestions,
  resolveCuratedSelection,
  transitionPrepPlan,
  type PrepQuestionSource,
  type QuestionAudience,
  type QuestionCategory,
  type QuestionTarget,
  type ResearchPipelineStep
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";
import { formatCandidateBackgroundForPrompt } from "./candidateBackgroundText.js";
import {
  JobCancellationRegistry,
  USER_CANCEL_MESSAGE
} from "./jobCancellationRegistry.js";
import {
  answerDraftBatchSchema,
  clarificationListSchema,
  companyProfileSchema,
  curatedBankSelectionSchema
} from "./knowledgeSchemas.js";
import { describePipelineFailure, PrepPipelineError } from "./pipelineErrors.js";
import {
  buildAnswerDraftSystemPrompt,
  buildClarificationSystemPrompt,
  buildCurationSystemPrompt,
  buildResearchSystemPrompt
} from "./prompts.js";

/**
 * Per-step budgets for reasoning calls. The client default (60s) is too short:
 * web search with reasoning "high" measured ~110s.
 */
const WEB_SEARCH_TIMEOUT_MS = 300_000;
const RESEARCH_STEP_TIMEOUT_MS = 180_000;
const CURATION_TIMEOUT_MS = 180_000;
const ANSWER_DRAFT_TIMEOUT_MS = 180_000;
const ANSWER_DRAFT_BATCH_SIZE = 10;

export interface PipelineFailureLogger {
  error(details: Record<string, unknown>, message: string): void;
}

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

export class PrepResearchService {
  private readonly running = new Set<string>();

  constructor(
    private readonly llmClient: LlmClient,
    private readonly repository: InterviewPrepRepository,
    private readonly cancellationRegistry: JobCancellationRegistry,
    private readonly failureLogger: PipelineFailureLogger
  ) {}

  /** Persists the user-facing reason and logs the raw cause, which the plan row does not keep. */
  private async markFailed(userId: string, planId: string, error: unknown, fallback: string): Promise<void> {
    const message = describePipelineFailure(error, fallback);
    const raw = error as { name?: string; status?: number; code?: string; message?: string };
    const plan = await this.repository.getPrepPlan(userId, planId);
    this.failureLogger.error(
      {
        planId,
        pipelineStep: plan?.pipelineStep,
        model: plan?.researchModel,
        errName: raw?.name,
        errStatus: raw?.status,
        errCode: raw?.code,
        errMessage: String(raw?.message ?? error)
      },
      "Prep plan pipeline step failed"
    );
    await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
  }

  async startResearch(userId: string, planId: string): Promise<void> {
    await this.prepareResearch(userId, planId);
    const key = JobCancellationRegistry.researchKey(planId);
    const signal = this.cancellationRegistry.begin(key);
    try {
      await this.runResearch(userId, planId, signal);
    } finally {
      this.cancellationRegistry.end(key);
    }
  }

  /**
   * Accepts research and returns the plan in the searching step.
   * The LLM pipeline continues after the HTTP response.
   * A second call while the same plan is running returns the current plan.
   */
  async enqueueResearch(userId: string, planId: string) {
    return this.enqueue(userId, planId, "research", () => this.prepareResearch(userId, planId), (signal) =>
      this.runResearch(userId, planId, signal)
    );
  }

  async enqueueClarifications(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>,
    skip = false
  ) {
    return this.enqueue(
      userId,
      planId,
      "curate",
      () => this.prepareClarifications(userId, planId),
      (signal) => this.submitClarificationsAndCurate(userId, planId, answers, skip, signal)
    );
  }

  /**
   * Resumes a failed/cancelled plan from the persisted pipeline step
   * without redoing finished research artefacts.
   */
  async enqueueResume(userId: string, planId: string) {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    if (plan.status !== "failed" && plan.status !== "cancelled") {
      throw new Error("Planen kan bare gjenopptas når den har feilet eller er stoppet.");
    }

    const point = prepPlanResumePoint(plan.pipelineStep, plan.clarificationRound);

    if (point.kind === "awaiting_answers") {
      const next = transitionPrepPlan(plan.status, { type: "resume_answers" });
      const updated = await this.repository.updatePrepPlanStatus(userId, planId, next);
      if (!updated) throw new Error("Plan ikke funnet.");
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "awaiting_answers" });
      const current = await this.repository.getPrepPlan(userId, planId);
      if (!current) throw new Error("Plan ikke funnet.");
      return current;
    }

    if (point.kind === "answers") {
      return this.enqueue(
        userId,
        planId,
        "curate",
        async () => {
          const next = transitionPrepPlan(plan.status, { type: "resume_answers_draft" });
          await this.repository.updatePrepPlanStatus(userId, planId, next);
          const updated = await this.repository.setPrepPlanPipeline(userId, planId, {
            pipelineStep: "drafting_answers"
          });
          if (!updated) throw new Error("Plan ikke funnet.");
          return updated;
        },
        (signal) => this.draftAnswers(userId, planId, signal)
      );
    }

    if (point.kind === "curation") {
      return this.enqueue(
        userId,
        planId,
        "curate",
        async () => {
          const next = transitionPrepPlan(plan.status, { type: "resume_curation" });
          await this.repository.updatePrepPlanStatus(userId, planId, next);
          const updated = await this.repository.setPrepPlanPipeline(userId, planId, {
            pipelineStep: "curating_questions"
          });
          if (!updated) throw new Error("Plan ikke funnet.");
          return updated;
        },
        (signal) => this.curate(userId, planId, signal)
      );
    }

    return this.enqueue(
      userId,
      planId,
      "research",
      async () => {
        const next = transitionPrepPlan(plan.status, { type: "resume_research" });
        await this.repository.updatePrepPlanStatus(userId, planId, next);
        const from = point.from === "created" ? "searching" : point.from;
        const updated = await this.repository.setPrepPlanPipeline(userId, planId, {
          pipelineStep: from
        });
        if (!updated) throw new Error("Plan ikke funnet.");
        return updated;
      },
      (signal) => this.runResearch(userId, planId, signal, point.from)
    );
  }

  /** True while a research or curation job for the plan is still running in this process. */
  isRunning(planId: string): boolean {
    return this.running.has(`research:${planId}`) || this.running.has(`curate:${planId}`);
  }

  async cancel(userId: string, planId: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) return { ok: false, status: 404, message: "Plan ikke funnet." };
    if (!canCancelPrepPlan(plan.status)) {
      return { ok: false, status: 409, message: "Planen kan bare stoppes under research eller kuratering." };
    }
    const researchKey = JobCancellationRegistry.researchKey(planId);
    const curateKey = JobCancellationRegistry.curateKey(planId);
    const aborted =
      this.cancellationRegistry.abort(researchKey) || this.cancellationRegistry.abort(curateKey);
    if (!aborted) {
      await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
    }
    return { ok: true };
  }

  private async enqueue(
    userId: string,
    planId: string,
    kind: "research" | "curate",
    prepare: () => Promise<NonNullable<Awaited<ReturnType<InterviewPrepRepository["getPrepPlan"]>>>>,
    work: (signal: AbortSignal) => Promise<void>
  ) {
    const key = `${kind}:${planId}`;
    if (this.running.has(key)) {
      const current = await this.repository.getPrepPlan(userId, planId);
      if (!current) throw new Error("Plan ikke funnet.");
      return current;
    }
    this.running.add(key);
    const cancelKey =
      kind === "research"
        ? JobCancellationRegistry.researchKey(planId)
        : JobCancellationRegistry.curateKey(planId);
    const signal = this.cancellationRegistry.begin(cancelKey);
    try {
      const plan = await prepare();
      void work(signal)
        .catch(async (error: unknown) => {
          if (isAbortError(error) || signal.aborted) {
            await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
            return;
          }
          const message = describePipelineFailure(error, "Plan-steg feilet.");
          await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
        })
        .finally(() => {
          this.running.delete(key);
          this.cancellationRegistry.end(cancelKey);
        });
      return plan;
    } catch (error) {
      this.running.delete(key);
      this.cancellationRegistry.end(cancelKey);
      throw error;
    }
  }

  private async prepareResearch(userId: string, planId: string) {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    if (plan.status !== "researching") {
      const researching = transitionPrepPlan(plan.status, { type: "start_research" });
      if (researching === plan.status) {
        throw new Error("Plan kan ikke starte research i denne statusen.");
      }
      await this.repository.updatePrepPlanStatus(userId, planId, researching);
    }
    // Fresh start: clear resume artefacts so "Start på nytt" is not contaminated.
    const updated = await this.repository.setPrepPlanPipeline(userId, planId, {
      pipelineStep: "searching",
      searchSnippet: "",
      researchNotes: "",
      companyProfileJson: "{}",
      curationFilledCount: 0
    });
    if (!updated) throw new Error("Plan ikke funnet.");
    return updated;
  }

  private async prepareClarifications(userId: string, planId: string) {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan || plan.status !== "awaiting_answers") {
      throw new Error("Plan venter ikke på svar.");
    }
    const updated = await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "clarifications" });
    if (!updated) throw new Error("Plan ikke funnet.");
    return updated;
  }

  /**
   * Runs research from `from` onward, reusing persisted artefacts for earlier steps.
   * Invariant: valid stored artefacts are never regenerated on resume.
   */
  private async runResearch(
    userId: string,
    planId: string,
    signal: AbortSignal,
    from: ResearchPipelineStep = "created"
  ): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    const model = plan.researchModel;
    const jobAdBlock = plan.jobAdText.trim()
      ? `\n\nStillingsannonse:\n${plan.jobAdText.trim()}`
      : "\n\nStillingsannonse: (ikke oppgitt)";

    const stepIndex = (step: ResearchPipelineStep) =>
      (["created", "searching", "research_notes", "company_profile", "clarifications"] as const).indexOf(step);
    const startIndex = stepIndex(from === "created" ? "searching" : from);

    try {
      let searchSnippet = plan.searchSnippet?.trim() ?? "";
      let researchNotes = plan.researchNotes?.trim() ?? "";
      let profileJson = plan.companyProfileJson;

      if (startIndex <= stepIndex("searching") || !searchSnippet) {
        throwIfAborted(signal);
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "searching" });
        searchSnippet = this.llmClient.webSearch
          ? await this.llmClient.webSearch(
              `${plan.companyName} ${plan.roleTitle} niche strategy products deals culture news interview why company`,
              { model, signal, timeoutMs: WEB_SEARCH_TIMEOUT_MS }
            )
          : "";
        await this.repository.setPrepPlanPipeline(userId, planId, {
          pipelineStep: "research_notes",
          searchSnippet
        });
      }

      if (startIndex <= stepIndex("research_notes") || !researchNotes) {
        throwIfAborted(signal);
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "research_notes" });
        researchNotes = await this.llmClient.complete({
          model,
          signal,
          timeoutMs: RESEARCH_STEP_TIMEOUT_MS,
          messages: [
            { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Oppsummer hva kandidaten bør vite om selskap, rolle og intervju.${jobAdBlock}\n\nNettfunn:\n${searchSnippet}`
            }
          ]
        });
        await this.repository.setPrepPlanPipeline(userId, planId, {
          pipelineStep: "company_profile",
          researchNotes
        });
      }

      let profile = tryParseProfile(profileJson);
      if (startIndex <= stepIndex("company_profile") || !profile) {
        throwIfAborted(signal);
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "company_profile" });
        profile = await this.llmClient.completeStructured(
          {
            model,
            signal,
            timeoutMs: RESEARCH_STEP_TIMEOUT_MS,
            messages: [
              { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
              {
                role: "user",
                content: `Lag et companyProfile-JSON basert på research.${jobAdBlock}\n\nResearch:\n${researchNotes}\nNettfunn:\n${searchSnippet}`
              }
            ]
          },
          companyProfileSchema
        );
        profileJson = JSON.stringify(profile);
        await this.repository.setPrepPlanPipeline(userId, planId, {
          pipelineStep: "clarifications",
          companyProfileJson: profileJson
        });
      }

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "clarifications" });
      const clarificationPayload = await this.llmClient.completeStructured(
        {
          model,
          signal,
          timeoutMs: RESEARCH_STEP_TIMEOUT_MS,
          messages: [
            { role: "system", content: buildClarificationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Research:\n${researchNotes}\n\nProfil:\n${profileJson}\n\nLag oppklaringsspørsmål om hull i research (ikke intervjuspørsmål).`
            }
          ]
        },
        clarificationListSchema
      );

      throwIfAborted(signal);
      await this.repository.setPrepPlanResearch(userId, planId, {
        researchNotes,
        companyProfileJson: profileJson,
        clarificationRound: 1,
        clarifications: clarificationPayload.clarifications.map((item, index) => ({
          question: item.question,
          sortOrder: index
        }))
      });

      const awaiting = transitionPrepPlan("researching", { type: "research_needs_answers" });
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "awaiting_answers" });
      await this.repository.updatePrepPlanStatus(userId, planId, awaiting);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
        throw Object.assign(new Error(USER_CANCEL_MESSAGE), { name: "AbortError" });
      }
      await this.markFailed(userId, planId, error, "Research feilet.");
      throw error;
    }
  }

  async submitClarificationsAndCurate(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>,
    skip = false,
    signal: AbortSignal = new AbortController().signal
  ): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan || plan.status !== "awaiting_answers") {
      throw new Error("Plan venter ikke på svar.");
    }

    if (!skip) {
      await this.repository.saveClarificationAnswers(userId, planId, answers);
    }

    const unanswered = plan.clarifications.filter((c) => {
      if (skip) return false;
      const answer = answers.find((a) => a.id === c.id)?.answer?.trim();
      return !answer && !c.answer.trim();
    });

    if (!skip && unanswered.length && plan.clarificationRound < MAX_CLARIFICATION_ROUNDS) {
      await this.requestAnotherClarificationRound(userId, planId, signal);
      return;
    }

    const next = transitionPrepPlan("awaiting_answers", {
      type: skip ? "clarifications_skipped" : "answers_submitted"
    });
    await this.repository.updatePrepPlanStatus(userId, planId, next);
    await this.curate(userId, planId, signal);
  }

  private async requestAnotherClarificationRound(
    userId: string,
    planId: string,
    signal: AbortSignal
  ): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    const nextRound = plan.clarificationRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) {
      throw new Error("Maks antall avklaringsrunder er nådd.");
    }

    throwIfAborted(signal);
    const payload = await this.llmClient.completeStructured(
      {
        model: plan.researchModel,
        signal,
        timeoutMs: RESEARCH_STEP_TIMEOUT_MS,
        messages: [
          { role: "system", content: buildClarificationSystemPrompt(plan.companyName, plan.roleTitle) },
          {
            role: "user",
            content: `Tidligere svar:\n${plan.clarifications
              .map((c) => `${c.question}\nSvar: ${c.answer || "(tomt)"}`)
              .join("\n\n")}\n\nLag flere oppklaringsspørsmål om bedrift/rolle (ikke intervjuspørsmål).`
          }
        ]
      },
      clarificationListSchema
    );

    await this.repository.appendClarificationRound(
      userId,
      planId,
      payload.clarifications.map((item, index) => ({ question: item.question, sortOrder: index })),
      nextRound
    );
    await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "awaiting_answers" });
    transitionPrepPlan("awaiting_answers", { type: "more_clarifications" });
  }

  private async curate(userId: string, planId: string, signal: AbortSignal): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");

    try {
      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "curating_questions" });
      const profile = safeParseProfile(plan.companyProfileJson);
      const bank = await this.repository.listBankQuestions(userId, { status: "active" });
      const candidateBank = bank.filter((q) => q.audience === "candidate");

      if (candidateBank.length < MIN_CURATED_QUESTIONS) {
        throw new PrepPipelineError(
          "curating_questions",
          `Spørsmålsbanken har bare ${candidateBank.length} aktive spørsmål; planen trenger minst ${MIN_CURATED_QUESTIONS}. Importer eller aktiver flere spørsmål.`
        );
      }

      const candidates = rankBankQuestions(
        {
          industries: profile.industries,
          themes: profile.themes,
          caseTypes: profile.caseTypes,
          interviewFormats: profile.interviewFormats,
          values: profile.values
        },
        candidateBank.map((q) => ({
          id: q.id,
          text: q.text,
          category: q.category,
          tags: q.tags,
          audience: q.audience,
          status: q.status
        })),
        120
      );

      const candidateLines = candidates
        .map((q, index) => `Q${index + 1} | ${q.category} | ${q.text}`)
        .join("\n");

      throwIfAborted(signal);
      const selection = await this.llmClient.completeStructured(
        {
          model: plan.researchModel,
          signal,
          timeoutMs: CURATION_TIMEOUT_MS,
          messages: [
            { role: "system", content: buildCurationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: [
                `Research:\n${plan.researchNotes}`,
                `Profil:\n${JSON.stringify(profile)}`,
                `Avklaringer:\n${plan.clarifications.map((c) => `${c.question}\nSvar: ${c.answer}`).join("\n\n")}`,
                `Kandidater fra banken (velg ${MIN_CURATED_QUESTIONS}-${MAX_CURATED_QUESTIONS} alias Q1…):\n${candidateLines}`
              ].join("\n\n")
            }
          ]
        },
        curatedBankSelectionSchema
      );

      const resolved = resolveCuratedSelection(selection.selectedRefs, candidates, {
        min: MIN_CURATED_QUESTIONS,
        max: MAX_CURATED_QUESTIONS
      });

      if (resolved.ids.length < MIN_CURATED_QUESTIONS) {
        throw new PrepPipelineError(
          "curating_questions",
          `Kuratering fikk bare ${resolved.ids.length} gyldige bankspørsmål (trenger minst ${MIN_CURATED_QUESTIONS}).`
        );
      }

      const selected = await this.repository.getBankQuestionsByIds(userId, resolved.ids);
      const byId = new Map(selected.map((q) => [q.id, q]));
      const questions: CuratedQuestion[] = [];

      for (const id of resolved.ids) {
        const q = byId.get(id);
        if (!q) continue;
        questions.push({
          text: q.text,
          category: q.category,
          audience: "candidate",
          target: "interview",
          source: "bank",
          bankQuestionId: q.id
        });
      }

      for (const generated of selection.generatedQuestions) {
        questions.push({
          text: generated.text,
          category: generated.category,
          audience: "candidate",
          target: generated.target,
          source: "generated",
          gapReason: generated.gapReason
        });
      }

      throwIfAborted(signal);
      await this.repository.setPrepPlanCurated(userId, planId, {
        questions,
        curationFilledCount: resolved.filledCount
      });
      await this.repository.setPrepPlanPipeline(userId, planId, {
        pipelineStep: "drafting_answers",
        curationFilledCount: resolved.filledCount
      });

      await this.draftAnswers(userId, planId, signal);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
        throw Object.assign(new Error(USER_CANCEL_MESSAGE), { name: "AbortError" });
      }
      await this.markFailed(userId, planId, error, "Kuratering feilet.");
      throw error;
    }
  }

  private async draftAnswers(userId: string, planId: string, signal: AbortSignal): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");

    try {
      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "drafting_answers" });

      const included = plan.questions.filter(
        (q) => q.included && (q.audience ?? "candidate") === "candidate"
      );
      const unanswered = included.filter((q) => !q.exampleAnswer.trim());
      if (unanswered.length === 0) {
        const ready = transitionPrepPlan("curating", { type: "curation_done" });
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "ready" });
        await this.repository.updatePrepPlanStatus(userId, planId, ready);
        return;
      }

      const backgroundRow = await this.repository.getCandidateBackground(userId);
      const backgroundBlock =
        formatCandidateBackgroundForPrompt({
          cvText: backgroundRow?.cvText ?? "",
          transcriptText: backgroundRow?.transcriptText ?? "",
          notes: backgroundRow?.notes ?? ""
        }) || "Ingen CV/karakterutskrift lastet opp. Bruk plassholdere der personlige fakta mangler.";

      const batches: typeof unanswered[] = [];
      for (let i = 0; i < unanswered.length; i += ANSWER_DRAFT_BATCH_SIZE) {
        batches.push(unanswered.slice(i, i + ANSWER_DRAFT_BATCH_SIZE));
      }

      for (const batch of batches) {
        throwIfAborted(signal);
        const aliasedLines = batch.map(
          (q, index) => `Q${index + 1} | ${q.category} | ${q.text}`
        );
        const result = await this.llmClient.completeStructured(
          {
            model: plan.researchModel,
            signal,
            timeoutMs: ANSWER_DRAFT_TIMEOUT_MS,
            messages: [
              {
                role: "system",
                content: buildAnswerDraftSystemPrompt(plan.companyName, plan.roleTitle)
              },
              {
                role: "user",
                content: [
                  `Kandidatbakgrunn:\n${backgroundBlock}`,
                  `Research:\n${plan.researchNotes}`,
                  `Profil:\n${plan.companyProfileJson}`,
                  `Spørsmål i denne batchen:\n${aliasedLines.join("\n")}`
                ].join("\n\n")
              }
            ]
          },
          answerDraftBatchSchema
        );

        const mapped = mapDraftsToQuestions(result.drafts, batch);
        if (mapped.length > 0) {
          await this.repository.setPrepPlanAnswerDrafts(userId, planId, mapped);
        }
      }

      const ready = transitionPrepPlan("curating", { type: "curation_done" });
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "ready" });
      await this.repository.updatePrepPlanStatus(userId, planId, ready);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
        throw Object.assign(new Error(USER_CANCEL_MESSAGE), { name: "AbortError" });
      }
      await this.markFailed(userId, planId, error, "Svargenerering feilet.");
      throw error;
    }
  }
}

/**
 * Maps LLM answer drafts onto questions by alias. Drops unknown/duplicate aliases;
 * unanswered questions stay empty.
 */
function mapDraftsToQuestions(
  drafts: Array<{ questionAlias: string; exampleAnswer: string; tips: string[] }>,
  batch: Array<{ id: string }>
): Array<{ questionAlias: string; exampleAnswer: string; tips: string[] }> {
  const seen = new Set<string>();
  const result: Array<{ questionAlias: string; exampleAnswer: string; tips: string[] }> = [];
  for (const draft of drafts) {
    const alias = draft.questionAlias;
    const match = alias.match(/^Q(\d+)$/i);
    if (!match) continue;
    const index = parseInt(match[1], 10) - 1;
    if (index < 0 || index >= batch.length) continue;
    const questionId = batch[index].id;
    if (seen.has(questionId)) continue;
    seen.add(questionId);
    result.push({ questionAlias: questionId, exampleAnswer: draft.exampleAnswer, tips: draft.tips });
  }
  return result;
}

interface CuratedQuestion {
  text: string;
  category: QuestionCategory;
  audience?: QuestionAudience;
  target: QuestionTarget;
  source: PrepQuestionSource;
  bankQuestionId?: string;
  gapReason?: string;
  notes?: string;
}

/** Strict parse: returns null when JSON is missing or invalid (forces re-run on resume). */
function tryParseProfile(json: string) {
  try {
    if (!json || json === "{}") return null;
    return companyProfileSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}

function safeParseProfile(json: string) {
  try {
    return companyProfileSchema.parse(JSON.parse(json || "{}"));
  } catch {
    return companyProfileSchema.parse({});
  }
}

