import { transitionPrepPlan } from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";
import { buildResearchSystemPrompt } from "./prompts.js";
import { clarificationListSchema, curatedPlanSchema } from "./knowledgeSchemas.js";

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
        ? await this.llmClient.webSearch(`${plan.companyName} ${plan.roleTitle} interview`)
        : "";

      const researchNotes = await this.llmClient.complete({
        messages: [
          { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
          {
            role: "user",
            content: `Oppsummer hva kandidaten bør vite. Nettfunn:\n${searchSnippet}`
          }
        ]
      });

      const clarificationPayload = await this.llmClient.completeStructured(
        {
          messages: [
            { role: "system", content: buildResearchSystemPrompt(plan.companyName, plan.roleTitle) },
            {
              role: "user",
              content: "Lag 2–4 avklaringsspørsmål til kandidaten basert på research."
            }
          ]
        },
        clarificationListSchema
      );

      await this.repository.setPrepPlanResearch(userId, planId, {
        researchNotes,
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
    answers: Array<{ id: string; answer: string }>
  ): Promise<void> {
    const plan = await this.repository.getPrepPlan(userId, planId);
    if (!plan || plan.status !== "awaiting_answers") {
      throw new Error("Plan venter ikke på svar.");
    }

    await this.repository.saveClarificationAnswers(userId, planId, answers);
    const curating = transitionPrepPlan("awaiting_answers", { type: "answers_submitted" });
    await this.repository.updatePrepPlanStatus(userId, planId, curating);

    const refreshed = await this.repository.getPrepPlan(userId, planId);
    if (!refreshed) throw new Error("Plan ikke funnet.");

    try {
      const curated = await this.llmClient.completeStructured(
        {
          messages: [
            { role: "system", content: buildResearchSystemPrompt(refreshed.companyName, refreshed.roleTitle) },
            {
              role: "user",
              content: `Research:\n${refreshed.researchNotes}\n\nAvklaringer:\n${refreshed.clarifications
                .map((item) => `${item.question}\nSvar: ${item.answer}`)
                .join("\n\n")}\n\nLag spørsmål og oppgaver.`
            }
          ]
        },
        curatedPlanSchema
      );

      await this.repository.setPrepPlanCurated(userId, planId, curated);
      const ready = transitionPrepPlan("curating", { type: "curation_done" });
      await this.repository.updatePrepPlanStatus(userId, planId, ready);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kuratering feilet.";
      await this.repository.updatePrepPlanStatus(userId, planId, "failed", message);
      throw error;
    }
  }
}
