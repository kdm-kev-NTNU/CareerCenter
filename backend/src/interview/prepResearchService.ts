import {
  MAX_CLARIFICATION_ROUNDS,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  canCancelPrepPlan,
  categoryForAudience,
  prepPlanResumePoint,
  rankBankQuestions,
  rankCasesForCompany,
  resolveCuratedSelection,
  transitionPrepPlan,
  type PrepQuestionSource,
  type QuestionAudience,
  type QuestionCategory,
  type QuestionTarget,
  type ResearchPipelineStep
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewBankQuestionRecord, InterviewPrepRepository } from "../interviewPrepRepository.js";
import {
  JobCancellationRegistry,
  USER_CANCEL_MESSAGE
} from "./jobCancellationRegistry.js";
import {
  clarificationListSchema,
  companyProfileSchema,
  companyReportSchema,
  curatedBankSelectionSchema
} from "./knowledgeSchemas.js";
import { describePipelineFailure, PrepPipelineError } from "./pipelineErrors.js";
import {
  buildClarificationSystemPrompt,
  buildCompanyReportSystemPrompt,
  buildCurationSystemPrompt,
  buildResearchSystemPrompt
} from "./prompts.js";

const CURATION_TIMEOUT_MS = 180_000;

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
    private readonly cancellationRegistry: JobCancellationRegistry
  ) {}

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
      companyReportJson: "",
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
      (["created", "searching", "research_notes", "company_profile", "company_report", "clarifications"] as const).indexOf(
        step
      );
    const startIndex = stepIndex(from === "created" ? "searching" : from);

    try {
      let searchSnippet = plan.searchSnippet?.trim() ?? "";
      let researchNotes = plan.researchNotes?.trim() ?? "";
      let profileJson = plan.companyProfileJson;
      let reportJson = plan.companyReportJson;

      if (startIndex <= stepIndex("searching") || !searchSnippet) {
        throwIfAborted(signal);
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "searching" });
        searchSnippet = this.llmClient.webSearch
          ? await this.llmClient.webSearch(
              `${plan.companyName} ${plan.roleTitle} niche strategy products deals culture news interview why company`,
              { model, signal }
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
          pipelineStep: "company_report",
          companyProfileJson: profileJson
        });
      }

      let report = tryParseReport(reportJson);
      if (startIndex <= stepIndex("company_report") || !report) {
        throwIfAborted(signal);
        await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "company_report" });
        report = await this.llmClient.completeStructured(
          {
            model,
            signal,
            messages: [
              {
                role: "system",
                content: buildCompanyReportSystemPrompt(plan.companyName, plan.roleTitle)
              },
              {
                role: "user",
                content: [
                  `Lag en companyReport-JSON (bedriftsrapport) for kandidaten.`,
                  jobAdBlock.trim(),
                  `Research:\n${researchNotes}`,
                  `Profil:\n${profileJson}`,
                  `Nettfunn:\n${searchSnippet}`
                ].join("\n\n")
              }
            ]
          },
          companyReportSchema
        );
        reportJson = JSON.stringify(report);
        await this.repository.setPrepPlanPipeline(userId, planId, {
          pipelineStep: "clarifications",
          companyReportJson: reportJson
        });
      }

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "clarifications" });
      const clarificationPayload = await this.llmClient.completeStructured(
        {
          model,
          signal,
          messages: [
            { role: "system", content: buildClarificationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Research:\n${researchNotes}\n\nProfil:\n${profileJson}\n\nRapport:\n${reportJson}\n\nLag oppklaringsspørsmål om hull i research (ikke intervjuspørsmål).`
            }
          ]
        },
        clarificationListSchema
      );

      throwIfAborted(signal);
      await this.repository.setPrepPlanResearch(userId, planId, {
        researchNotes,
        companyProfileJson: profileJson,
        companyReportJson: reportJson,
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
      const message = describePipelineFailure(error, "Research feilet.");
      await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
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
      const reverseBank = bank.filter((q) => q.audience !== "candidate");

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

      const report = safeParseReport(plan.companyReportJson);
      const candidateLines = candidates
        .map((q, index) => `Q${index + 1} | ${q.category} | ${q.text}`)
        .join("\n");
      const reverseLines =
        reverseBank.map((q, index) => `R${index + 1} | ${q.audience} | ${q.text}`).join("\n") || "–";

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
                `Bedriftsrapport (nisje-info og svarforslag):\n${JSON.stringify({
                  nicheInsights: report.nicheInsights,
                  companyQuestionPrep: report.companyQuestionPrep,
                  interviewAngles: report.interviewAngles
                })}`,
                `Avklaringer:\n${plan.clarifications.map((c) => `${c.question}\nSvar: ${c.answer}`).join("\n\n")}`,
                `Kandidater fra banken (velg ${MIN_CURATED_QUESTIONS}-${MAX_CURATED_QUESTIONS} alias Q1…):\n${candidateLines}`,
                `Spørsmål kandidaten kan stille intervjueren (alias R1…):\n${reverseLines}`,
                `Forslag fra bedriftsrapporten:\n${report.questionsToAsk.join("\n") || "–"}`
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
          target: "interview",
          source: "bank",
          bankQuestionId: q.id
        });
      }

      for (const generated of selection.generatedQuestions) {
        questions.push({
          text: generated.text,
          category: generated.category,
          target: generated.target,
          source: "generated",
          gapReason: generated.gapReason
        });
      }

      attachCompanyAnswerNotes(questions, report);

      const reversePicks = selection.reverseQuestions.map((pick) => ({
        text: pick.text,
        audience: pick.audience,
        bankQuestionId: resolveReverseBankRef(pick.bankRef, reverseBank)
      }));
      questions.push(...buildReverseQuestions(reversePicks, reverseBank, report.questionsToAsk));

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "curating_cases" });
      const cases = await this.repository.searchCaseEntries(userId, { approvalStatus: "approved" });
      const ranked = rankCasesForCompany(
        {
          industries: profile.industries,
          caseTypes: profile.caseTypes.length ? profile.caseTypes : ["case"],
          style: undefined
        },
        cases.map((entry) => ({
          id: entry.id,
          industry: entry.companyTags[0] ?? null,
          caseType: entry.sourceKind,
          style: entry.caseStyle ?? null
        }))
      );
      const recommendedCaseIds = ranked.slice(0, 8).map((c) => c.id);
      const tasks = mergeCompanyPrepTasks(selection.tasks, report);

      await this.repository.setPrepPlanCurated(userId, planId, {
        questions,
        tasks,
        recommendedCaseIds,
        curationFilledCount: resolved.filledCount
      });
      const ready = transitionPrepPlan("curating", { type: "curation_done" });
      await this.repository.setPrepPlanPipeline(userId, planId, {
        pipelineStep: "ready",
        curationFilledCount: resolved.filledCount
      });
      await this.repository.updatePrepPlanStatus(userId, planId, ready);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
        throw Object.assign(new Error(USER_CANCEL_MESSAGE), { name: "AbortError" });
      }
      const message = describePipelineFailure(error, "Kuratering feilet.");
      await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
      throw error;
    }
  }
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

const MAX_REVERSE_COMPANY = 5;
const MAX_REVERSE_PERSONAL = 3;

function resolveReverseBankRef(
  bankRef: string | null | undefined,
  reverseBank: InterviewBankQuestionRecord[]
): string | null {
  if (!bankRef) return null;
  const match = /^R(\d+)$/i.exec(bankRef.trim());
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return reverseBank[index]?.id ?? null;
}

/**
 * Questions the candidate asks the interviewer, from the curation result.
 * Falls back to the company report suggestions and personal bank questions when the model returns none.
 */
export function buildReverseQuestions(
  picks: Array<{ text: string; audience: "ask_interviewer_company" | "ask_interviewer_personal"; bankQuestionId: string | null }>,
  reverseBank: InterviewBankQuestionRecord[],
  reportSuggestions: string[]
): CuratedQuestion[] {
  const byId = new Map(reverseBank.map((q) => [q.id, q]));
  const counts = { ask_interviewer_company: 0, ask_interviewer_personal: 0 };
  const limits = { ask_interviewer_company: MAX_REVERSE_COMPANY, ask_interviewer_personal: MAX_REVERSE_PERSONAL };
  const seen = new Set<string>();
  const out: CuratedQuestion[] = [];

  for (const pick of picks) {
    const text = pick.text.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key) || counts[pick.audience] >= limits[pick.audience]) continue;
    seen.add(key);
    counts[pick.audience] += 1;
    const bankQuestion = pick.bankQuestionId ? byId.get(pick.bankQuestionId) : undefined;
    out.push({
      text,
      category: categoryForAudience(pick.audience, "company"),
      audience: pick.audience,
      target: "interview",
      source: bankQuestion ? (bankQuestion.text.trim() === text ? "bank" : "edited") : "generated",
      bankQuestionId: bankQuestion?.id
    });
  }
  if (out.length > 0) return out;

  for (const text of reportSuggestions.slice(0, 3)) {
    out.push({ text, category: "company", audience: "ask_interviewer_company", target: "interview", source: "generated" });
  }
  for (const q of reverseBank.filter((item) => item.audience === "ask_interviewer_personal").slice(0, 2)) {
    out.push({
      text: q.text,
      category: "personal",
      audience: "ask_interviewer_personal",
      target: "interview",
      source: "bank",
      bankQuestionId: q.id
    });
  }
  return out;
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

function tryParseReport(json: string) {
  try {
    if (!json || !json.trim()) return null;
    return companyReportSchema.parse(JSON.parse(json));
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

function safeParseReport(json: string) {
  try {
    return companyReportSchema.parse(JSON.parse(json || "{}"));
  } catch {
    return companyReportSchema.parse({});
  }
}

/**
 * Attaches answer-angle notes from the company report onto company-category questions.
 * Invariant: only fills empty notes; never overwrites existing notes.
 */
function attachCompanyAnswerNotes(
  questions: Array<{ category: QuestionCategory; audience?: QuestionAudience; text: string; notes?: string }>,
  report: ReturnType<typeof safeParseReport>
): void {
  const prep = [...report.companyQuestionPrep];
  if (prep.length === 0 && report.nicheInsights.length === 0) return;

  let prepIndex = 0;
  for (const question of questions) {
    if (question.category !== "company" || (question.audience ?? "candidate") !== "candidate") continue;
    if (question.notes?.trim()) continue;

    const match =
      prep.find((item) =>
        question.text.toLowerCase().includes(item.question.toLowerCase().slice(0, 24))
      ) ?? prep[prepIndex++];

    if (match) {
      const hooks = match.nicheHooks.length ? ` Nisje-hooks: ${match.nicheHooks.join("; ")}.` : "";
      question.notes = `Svarforslag: ${match.answerAngle}.${hooks}`;
      continue;
    }

    if (report.nicheInsights.length) {
      question.notes = `Bruk nisje-info: ${report.nicheInsights.slice(0, 2).join("; ")}.`;
    }
  }
}

/** Ensures at least one task drills company-specific answers using niche insights. */
function mergeCompanyPrepTasks(
  tasks: Array<{ title: string; description: string }>,
  report: ReturnType<typeof safeParseReport>
): Array<{ title: string; description: string }> {
  const merged = [...tasks];
  const hasCompanyPrepTask = merged.some(
    (t) =>
      /bedrift|hvorfor oss|nisje|company/i.test(`${t.title} ${t.description}`)
  );
  if (hasCompanyPrepTask) return merged;

  const firstPrep = report.companyQuestionPrep[0];
  if (firstPrep) {
    merged.unshift({
      title: "Øv bedriftsspesifikt svar",
      description: `Skriv et 60-sekunders svar på «${firstPrep.question}». Vinkel: ${firstPrep.answerAngle}${
        firstPrep.nicheHooks.length ? `. Bruk: ${firstPrep.nicheHooks.join("; ")}` : ""
      }`
    });
    return merged;
  }

  if (report.nicheInsights.length) {
    merged.unshift({
      title: "Øv «Hvorfor oss?» med nisje-info",
      description: `Lag et konkret svar som bruker: ${report.nicheInsights.slice(0, 3).join("; ")}.`
    });
  }
  return merged;
}
