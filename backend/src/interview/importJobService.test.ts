import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { enqueueImportJob, processImportJob } from "./importJobService.js";

describe("importJobService", () => {
  it("enqueueImportJob drains without throwing", () => {
    expect(() => enqueueImportJob("u1", "job-1")).not.toThrow();
  });

  it("returns early when import job is missing", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient();
    await processImportJob({ llmClient, repository }, "u1", "missing");
    expect(llmClient.structuredCalls).toHaveLength(0);
  });

  it("marks job failed when knowledge doc is missing", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const job = await repository.createImportJob("u1", { knowledgeDocId: "missing-doc" });
    const llmClient = new FakeLlmClient();

    await processImportJob({ llmClient, repository }, "u1", job.id);

    const updated = await repository.getImportJob("u1", job.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.message).toMatch(/ikke funnet/i);
  });

  it("segments a casebook and creates pending cases", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Official Casebook 2024",
      content: "Case 1 and Case 2 content",
      contentHash: sha256Content("casebook-1")
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const llmClient = new FakeLlmClient({
      structuredResult: {
        cases: [
          { title: "Market entry", prompt: "Enter market", interviewerInfo: "hint", solution: "sol" },
          { title: "Profit", prompt: "Fix profit", interviewerInfo: "", solution: "" }
        ]
      }
    });

    await processImportJob({ llmClient, repository }, "u1", job.id);

    const updated = await repository.getImportJob("u1", job.id);
    expect(updated?.status).toBe("done");
    expect(updated?.progress).toBe(100);
    const cases = await repository.listCaseEntries("u1");
    expect(cases).toHaveLength(2);
    expect(cases.every((c) => c.approvalStatus === "pending")).toBe(true);
    expect(cases[0]?.sourceKind).toBe("casebook");
  });

  it("skips creating a case when content hash already exists", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Official Casebook 2024",
      content: "dup",
      contentHash: sha256Content("casebook-dup")
    });
    const hash = sha256Content("Existing:prompt:solution:0");
    await repository.createCaseEntry("u1", {
      title: "Existing",
      prompt: "prompt",
      interviewerInfo: "",
      solution: "solution",
      sourceKind: "casebook",
      companyTags: [],
      knowledgeDocId: doc.id,
      contentHash: hash,
      approvalStatus: "pending"
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const llmClient = new FakeLlmClient({
      structuredResult: {
        cases: [{ title: "Existing", prompt: "prompt", interviewerInfo: "", solution: "solution" }]
      }
    });

    await processImportJob({ llmClient, repository }, "u1", job.id);

    const cases = await repository.listCaseEntries("u1");
    expect(cases).toHaveLength(1);
    expect((await repository.getImportJob("u1", job.id))?.status).toBe("done");
  });

  it("creates an exhibit pack prompt awaiting approval", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Market entry exhibits",
      content: "Exhibit A numbers",
      contentHash: sha256Content("exhibit-1"),
      sourceFilename: "market-entry-exhibits.pdf"
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const llmClient = new FakeLlmClient({
      structuredResult: {
        title: "Exhibit case",
        prompt: "Use the exhibits",
        interviewerInfo: "secret",
        solution: "answer"
      }
    });

    await processImportJob({ llmClient, repository }, "u1", job.id);

    const updated = await repository.getImportJob("u1", job.id);
    expect(updated?.status).toBe("review");
    expect(updated?.message).toMatch(/godkjenning/i);
    const cases = await repository.listCaseEntries("u1");
    expect(cases).toHaveLength(1);
    expect(cases[0]?.sourceKind).toBe("exhibit_pack");
  });

  it("marks job failed when LLM throws", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Official Casebook 2024",
      content: "content",
      contentHash: sha256Content("casebook-fail")
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const llmClient = new FakeLlmClient();
    llmClient.completeStructured = async () => {
      throw new Error("boom");
    };

    await processImportJob({ llmClient, repository }, "u1", job.id);

    expect((await repository.getImportJob("u1", job.id))?.status).toBe("failed");
    expect((await repository.getImportJob("u1", job.id))?.message).toBe("boom");
  });
});
