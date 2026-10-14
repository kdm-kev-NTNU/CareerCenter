import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { PrepResearchService } from "./prepResearchService.js";
import { sha256Content } from "./contentHash.js";

describe("PrepResearchService", () => {
  it("runs research and bank-driven curation flow", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "STAR bank",
      content: Array.from({ length: 35 }, (_, i) => `${i + 1}. Question number ${i + 1} about leadership?`).join(
        "\n"
      ),
      contentHash: sha256Content("bank-doc")
    });
    await repository.replaceBankQuestionsForDoc(
      "u1",
      doc.id,
      Array.from({ length: 35 }, (_, i) => ({
        text: `Question number ${i + 1} about leadership?`,
        category: "behavioral" as const,
        tags: ["star"],
        contentHash: sha256Content(`q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const selectedIds = bank.slice(0, 30).map((q) => q.id);

    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: ["banking"],
          businessAreas: ["corporate"],
          interviewFormats: ["behavioral"],
          caseTypes: [],
          values: ["integrity"],
          themes: ["leadership"],
          summary: "DNB profile"
        },
        { clarifications: [{ question: "Hvilken avdeling?" }] },
        {
          selectedQuestionIds: selectedIds,
          generatedQuestions: [],
          tasks: [{ title: "Les årsrapport", description: "Noter tall." }]
        }
      ]
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
    expect(updated?.companyProfileJson).toContain("banking");

    await service.submitClarificationsAndCurate("u1", plan.id, [
      { id: updated!.clarifications[0]!.id, answer: "Corporate banking" }
    ]);

    updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
    expect(updated?.questions.length).toBe(30);
    expect(updated?.questions.every((q) => q.source === "bank")).toBe(true);
    expect(updated?.tasks.length).toBeGreaterThan(0);
  });

  it("allows skipping clarification round", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "STAR bank",
      content: "x",
      contentHash: sha256Content("bank-doc-2")
    });
    await repository.replaceBankQuestionsForDoc(
      "u1",
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: `Q ${i}?`,
        category: "behavioral" as const,
        tags: [],
        contentHash: sha256Content(`skip-q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: [],
          businessAreas: [],
          interviewFormats: [],
          caseTypes: [],
          values: [],
          themes: [],
          summary: ""
        },
        { clarifications: [{ question: "Format?" }] },
        {
          selectedQuestionIds: bank.map((q) => q.id),
          generatedQuestions: [],
          tasks: []
        }
      ]
    });
    const service = new PrepResearchService(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "X",
      roleTitle: "Y",
      format: "interview"
    });
    await service.startResearch("u1", plan.id);
    await service.submitClarificationsAndCurate("u1", plan.id, [], true);
    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
  });
});
