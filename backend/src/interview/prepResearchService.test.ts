import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { PrepResearchService } from "./prepResearchService.js";

describe("PrepResearchService", () => {
  it("runs research and curation flow", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      structuredResult: {
        clarifications: [{ question: "Hvilken avdeling?" }],
        questions: [{ text: "Fortell om en utfordring.", category: "behavioral", target: "interview" }],
        tasks: [{ title: "Les årsrapport", description: "Noter tall." }]
      }
    });
    const service = new PrepResearchService(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "DNB",
      roleTitle: "Consultant",
      format: "interview"
    });

    await service.startResearch("u1", plan.id);
    let updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("awaiting_answers");
    expect(updated?.clarifications).toHaveLength(1);

    await service.submitClarificationsAndCurate("u1", plan.id, [
      { id: updated!.clarifications[0]!.id, answer: "Corporate banking" }
    ]);

    updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
    expect(updated?.questions.length).toBeGreaterThan(0);
    expect(updated?.tasks.length).toBeGreaterThan(0);
  });
});
