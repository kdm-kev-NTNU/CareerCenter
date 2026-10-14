import {
  MAX_CLARIFICATION_ROUNDS,
  MAX_CURATED_QUESTIONS,
  MIN_CURATED_QUESTIONS,
  rankBankQuestions,
  rankCasesForCompany,
  transitionPrepPlan,
  type QuestionCategory,
  type QuestionTarget
} from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";
import {
  clarificationListSchema,
  companyProfileSchema,
  curatedBankSelectionSchema
} from "./knowledgeSchemas.js";
import {
  buildClarificationSystemPrompt,
  buildCurationSystemPrompt,
  buildResearchSystemPrompt
} from "./prompts.js";

export class PrepResearchService {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly repository: InterviewPrepRepository
  ) {}

  async startResearch(userId: string, planId: string): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    if (plan.status !== "draft" && plan.status !== "failed") {
      throw new Error("Plan kan ikke starte research i denne statusen.");
    }

    const researching = transitionPrepPlan(plan.status, { type: "start_research" });
    if (researching === plan.status) {
      throw new Error("Plan kan ikke starte research i denne statusen.");
    }
    await this.repository.updatePrepPlanStatus(userId, planId, researching);

    try {
      const searchSnippet = this.llmClient.webSearch
        ? await this.llmClient.webSearch(`${plan.companyName} ${plan.roleTitle} interview process culture`)
        : "";

      const researchNotes = await this.llmClient.complete({
        messages: [
          { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
          {
            role: "user",
            content: `Oppsummer hva kandidaten bør vite om selskap, rolle og intervju. Nettfunn:\n${searchSnippet}`
          }
        ]
      });

      const profile = await this.llmClient.completeStructured(
        {
          messages: [
            { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Lag et companyProfile-JSON basert på research.\nResearch:\n${researchNotes}\nNettfunn:\n${searchSnippet}`
            }
          ]
        },
        companyProfileSchema
      );

      const clarificationPayload = await this.llmClient.completeStructured(
        {
          messages: [
            { role: "system", content: buildClarificationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: `Research:\n${researchNotes}\n\nProfil:\n${JSON.stringify(profile)}\n\nLag oppklaringsspørsmål om hull i research (ikke intervjuspørsmål).`
            }
          ]
        },
        clarificationListSchema
      );

      await this.repository.setPrepPlanResearch(userId, planId, {
        researchNotes,
        companyProfileJson: JSON.stringify(profile),
        clarificationRound: 1,
        clarifications: clarificationPayload.clarifications.map((item, index) => ({
          question: item.question,
          sortOrder: index
        }))
      });

      const awaiting = transitionPrepPlan("researching", { type: "research_needs_answers" });
      await this.repository.updatePrepPlanStatus(userId, planId, awaiting);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research feilet.";
      await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
      throw error;
    }
  }

  async submitClarificationsAndCurate(
    userId: string,
    planId: string,
    answers: Array<{ id: string; answer: string }>,
    skip = false
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
      await this.requestAnotherClarificationRound(userId, planId);
      return;
    }

    const next = transitionPrepPlan("awaiting_answers", {
      type: skip ? "clarifications_skipped" : "answers_submitted"
    });
    await this.repository.updatePrepPlanStatus(userId, planId, next);
    await this.curate(userId, planId);
  }

  private async requestAnotherClarificationRound(userId: string, planId: string): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");
    const nextRound = plan.clarificationRound + 1;
    if (nextRound > MAX_CLARIFICATION_ROUNDS) {
      throw new Error("Maks antall avklaringsrunder er nådd.");
    }

    const payload = await this.llmClient.completeStructured(
      {
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
    transitionPrepPlan("awaiting_answers", { type: "more_clarifications" });
  }

  private async curate(userId: string, planId: string): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan) throw new Error("Plan ikke funnet.");

    try {
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

      const selection = await this.llmClient.completeStructured(
        {
          messages: [
            { role: "system", content: buildCurationSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: [
                `Research:\n${plan.researchNotes}`,
                `Profil:\n${JSON.stringify(profile)}`,
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

      await this.repository.setPrepPlanCurated(userId, planId, {
        questions,
        tasks: selection.tasks,
        recommendedCaseIds
      });
      const ready = transitionPrepPlan("curating", { type: "curation_done" });
      await this.repository.updatePrepPlanStatus(userId, planId, ready);
    } catch (error) {
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
