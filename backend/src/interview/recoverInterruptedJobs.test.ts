import { describe, expect, it } from "vitest";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { RESTART_INTERRUPT_MESSAGE } from "./jobCancellationRegistry.js";
import { recoverInterruptedJobs } from "./recoverInterruptedJobs.js";

describe("recoverInterruptedJobs", () => {
  it("marks queued/running import jobs and researching/curating plans as failed", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Doc",
      content: "x",
      contentHash: sha256Content("r1")
    });
    const running = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    await repository.updateImportJob("u1", running.id, { status: "running" });
    const queued = await repository.createImportJob("u1", { knowledgeDocId: doc.id, kind: "questions" });
    const done = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    await repository.updateImportJob("u1", done.id, { status: "done" });

    const researching = await repository.createPrepPlan("u1", {
      companyName: "A",
      roleTitle: "B",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repository.updatePrepPlanStatus("u1", researching.id, "researching");
    const ready = await repository.createPrepPlan("u1", {
      companyName: "C",
      roleTitle: "D",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repository.updatePrepPlanStatus("u1", ready.id, "ready");

    const result = await recoverInterruptedJobs(repository);
    expect(result.importJobs).toBe(2);
    expect(result.prepPlans).toBe(1);
    expect((await repository.getImportJob("u1", running.id))?.message).toBe(RESTART_INTERRUPT_MESSAGE);
    expect((await repository.getImportJob("u1", queued.id))?.status).toBe("failed");
    expect((await repository.getImportJob("u1", done.id))?.status).toBe("done");
    expect((await repository.getPrepPlan("u1", researching.id))?.status).toBe("failed");
    expect((await repository.getPrepPlan("u1", ready.id))?.status).toBe("ready");
  });
});
