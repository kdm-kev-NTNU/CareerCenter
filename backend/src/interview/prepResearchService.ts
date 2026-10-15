import {
  MAX_CLARIFICATION_ROUNDS,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  canCancelPrepPlan,
  rankBankQuestions,
  rankCasesForCompany,
  transitionPrepPlan,
  type QuestionCategory,
  type QuestionTarget
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";
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
import {
  buildClarificationSystemPrompt,
  buildCompanyReportSystemPrompt,
  buildCurationSystemPrompt,
  buildResearchSystemPrompt
} from "./prompts.js";

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
          const message = error instanceof Error ? error.message : "Plan-steg feilet.";
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
    const updated = await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "searching" });
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

  private async runResearch(userId: string, planId: string, signal: AbortSignal): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    const model = plan.researchModel;
    const jobAdBlock = plan.jobAdText.trim()
      ? `\n\nStillingsannonse:\n${plan.jobAdText.trim()}`
      : "\n\nStillingsannonse: (ikke oppgitt)";

    try {
      throwIfAborted(signal);
      const searchSnippet = this.llmClient.webSearch
        ? await this.llmClient.webSearch(
            `${plan.companyName} ${plan.roleTitle} company overview strategy news culture interview process`,
            { model, signal }
          )
        : "";

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "research_notes" });
      const researchNotes = await this.llmClient.complete({
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

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, {
        pipelineStep: "company_profile",
        researchNotes
      });
      const profile = await this.llmClient.completeStructured(
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

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, {
        pipelineStep: "company_report",
        companyProfileJson: JSON.stringify(profile)
      });
      const report = await this.llmClient.completeStructured(
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
                `Profil:\n${JSON.stringify(profile)}`,
                `Nettfunn:\n${searchSnippet}`
              ].join("\n\n")
            }
          ]
        },
        companyReportSchema
      );
      const companyReportJson = JSON.stringify(report);

      throwIfAborted(signal);
      await this.repository.setPrepPlanPipeline(userId, planId, {
        pipelineStep: "clarifications",
        companyReportJson
      });
      const clarificationPayload = await this.llmClient.completeStructured(
        {
          model,
          signal,
          messages: [
            { role: "system", content: buildClarificationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Research:\n${researchNotes}\n\nProfil:\n${JSON.stringify(profile)}\n\nRapport:\n${companyReportJson}\n\nLag oppklaringsspørsmål om hull i research (ikke intervjuspørsmål).`
            }
          ]
        },
        clarificationListSchema
      );

      throwIfAborted(signal);
      await this.repository.setPrepPlanResearch(userId, planId, {
        researchNotes,
        companyProfileJson: JSON.stringify(profile),
        companyReportJson,
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
      const message = error instanceof Error ? error.message : "Research feilet.";
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
      const bank = await this.repository.listBankQuestions(userId);
      const candidates = rankBankQuestions(
        {
          industries: profile.industries,
          themes: profile.themes,
          caseTypes: profile.caseTypes,
          interviewFormats: profile.interviewFormats,
          values: profile.values
        },
        bank.map((q) => ({ id: q.id, text: q.text, category: q.category, tags: q.tags })),
        120
      );

      const report = safeParseReport(plan.companyReportJson);

      throwIfAborted(signal);
      const selection = await this.llmClient.completeStructured(
        {
          model: plan.researchModel,
          signal,
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
                `Kandidater fra banken (velg ${MIN_CURATED_QUESTIONS}-${MAX_CURATED_QUESTIONS} id-er):\n${candidates
                  .map((q) => `${q.id} | ${q.category} | ${q.text}`)
                  .join("\n")}`
              ].join("\n\n")
            }
          ]
        },
        curatedBankSelectionSchema
      );

      const selected = await this.repository.getBankQuestionsByIds(userId, selection.selectedQuestionIds);
      if (selected.length !== selection.selectedQuestionIds.length) {
        throw new Error("Kuratering refererte spørsmål utenfor banken.");
      }
      if (selected.length < MIN_CURATED_QUESTIONS) {
        throw new Error(`Kuratering må ha minst ${MIN_CURATED_QUESTIONS} bankspørsmål.`);
      }

      const byId = new Map(selected.map((q) => [q.id, q]));
      const questions: Array<{
        text: string;
        category: QuestionCategory;
        target: QuestionTarget;
        source: "bank" | "generated";
        bankQuestionId?: string;
        gapReason?: string;
        notes?: string;
      }> = [];

      for (const id of selection.selectedQuestionIds) {
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
        recommendedCaseIds
      });
      const ready = transitionPrepPlan("curating", { type: "curation_done" });
      await this.repository.setPrepPlanPipeline(userId, planId, { pipelineStep: "ready" });
      await this.repository.updatePrepPlanStatus(userId, planId, ready);
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        await this.repository.updatePrepPlanStatus(userId, planId, "cancelled", USER_CANCEL_MESSAGE);
        throw Object.assign(new Error(USER_CANCEL_MESSAGE), { name: "AbortError" });
      }
      const message = error instanceof Error ? error.message : "Kuratering feilet.";
      await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
      throw error;
    }
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
  questions: Array<{ category: QuestionCategory; text: string; notes?: string }>,
  report: ReturnType<typeof safeParseReport>
): void {
  const prep = [...report.companyQuestionPrep];
  if (prep.length === 0 && report.nicheInsights.length === 0) return;

  let prepIndex = 0;
  for (const question of questions) {
    if (question.category !== "company") continue;
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
