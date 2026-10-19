import { describe, expect, it } from "vitest";
import { InterviewPrepMemoryRepository } from "./interviewPrepMemoryRepository.js";

describe("InterviewPrepMemoryRepository answer drafts", () => {
  it("clears exampleAnswer and tips when question text changes", async () => {
    const repo = new InterviewPrepMemoryRepository();
    const plan = await repo.createPrepPlan("u1", {
      companyName: "Acme",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated("u1", plan.id, {
      questions: [
        { text: "Original?", category: "behavioral", target: "interview", source: "bank" }
      ]
    });
    let current = await repo.getPrepPlan("u1", plan.id);
    const questionId = current!.questions[0]!.id;
    await repo.setPrepPlanAnswerDrafts("u1", plan.id, [
      { questionAlias: questionId, exampleAnswer: "Et svar", tips: ["Tips 1"] }
    ]);
    current = await repo.getPrepPlan("u1", plan.id);
    expect(current!.questions[0]!.exampleAnswer).toBe("Et svar");

    await repo.patchPlanQuestion("u1", plan.id, questionId, { notes: "kun notater" });
    current = await repo.getPrepPlan("u1", plan.id);
    expect(current!.questions[0]!.exampleAnswer).toBe("Et svar");
    expect(current!.questions[0]!.tips).toEqual(["Tips 1"]);

    await repo.patchPlanQuestion("u1", plan.id, questionId, { text: "Endret?" });
    current = await repo.getPrepPlan("u1", plan.id);
    expect(current!.questions[0]!.exampleAnswer).toBe("");
    expect(current!.questions[0]!.tips).toEqual([]);
  });

  it("clears exampleAnswer and tips when question is replaced", async () => {
    const repo = new InterviewPrepMemoryRepository();
    const plan = await repo.createPrepPlan("u1", {
      companyName: "Acme",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated("u1", plan.id, {
      questions: [
        { text: "Original?", category: "behavioral", target: "interview", source: "bank" }
      ]
    });
    let current = await repo.getPrepPlan("u1", plan.id);
    const questionId = current!.questions[0]!.id;
    await repo.setPrepPlanAnswerDrafts("u1", plan.id, [
      { questionAlias: questionId, exampleAnswer: "Et svar", tips: ["Tips 1"] }
    ]);

    await repo.replacePlanQuestion("u1", plan.id, questionId, {
      text: "Byttet spørsmål?",
      category: "company",
      target: "interview",
      source: "edited"
    });
    current = await repo.getPrepPlan("u1", plan.id);
    expect(current!.questions[0]!.text).toBe("Byttet spørsmål?");
    expect(current!.questions[0]!.exampleAnswer).toBe("");
    expect(current!.questions[0]!.tips).toEqual([]);
  });
});
