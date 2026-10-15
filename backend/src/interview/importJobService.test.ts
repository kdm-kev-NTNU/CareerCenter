import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { cancelImportJob, processImportJob } from "./importJobService.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";

function deps(llmClient: FakeLlmClient, repository: InterviewPrepMemoryRepository) {
  return {
    llmClient,
    repository,
    cancellationRegistry: new JobCancellationRegistry()
  };
}

describe("question import", () => {
  it("stores audience and category from the model, skips known questions and triggers cleanup", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "company",
      title: "Bedrift",
      content: "Hva vet du om oss?\nSpørsmål du stiller dem: Hvordan ser en typisk uke ut?",
      contentHash: sha256Content("question-import")
    });
    await repository.insertBankQuestions("u1", doc.id, [
      { text: "Hva vet du om oss?", category: "company", tags: [], origin: "rule", contentHash: sha256Content("known") }
    ]);
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id, kind: "questions" });
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          questions: [
            { text: "«Hva vet du om oss?»", audience: "candidate", category: "company" },
            { text: "Hvordan ser en typisk uke ut?", audience: "ask_interviewer_company", category: "behavioral" },
            { text: "Kort?", audience: "candidate", category: "behavioral" }
          ]
        }
      ]
    });
    const imported: string[] = [];

    await processImportJob(
      { ...deps(llmClient, repository), onQuestionsImported: (_userId, docId) => imported.push(docId) },
      "u1",
      job.id
    );

    expect(await repository.getImportJob("u1", job.id)).toMatchObject({ status: "done" });
    const rows = await repository.listBankQuestions("u1", { knowledgeDocId: doc.id });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.text === "Hvordan ser en typisk uke ut?")).toMatchObject({
      audience: "ask_interviewer_company",
      category: "company",
      origin: "llm",
      tags: ["company", "llm"]
    });
    expect(imported).toEqual([doc.id]);
    const systemPrompt = llmClient.structuredCalls[0]!.options.messages[0]!.content;
    expect(systemPrompt).toContain("ask_interviewer_personal");
    expect(systemPrompt).toContain("Ikke ta med: instrukser til intervjueren");
  });
});

describe("importJobService", () => {
  it("returns early when import job is missing", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient();
    await processImportJob(deps(llmClient, repository), "u1", "missing");
    expect(llmClient.structuredCalls).toHaveLength(0);
  });

  it("marks job failed when knowledge doc is missing", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const job = await repository.createImportJob("u1", { knowledgeDocId: "missing-doc" });
    const llmClient = new FakeLlmClient();

    await processImportJob(deps(llmClient, repository), "u1", job.id);

    const updated = await repository.getImportJob("u1", job.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.message).toMatch(/ikke funnet/i);
  });

  it("extracts each case span without sending the whole book in one call", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const content = [
      "===== PAGE 1 =====",
      `Case 1: Alpha\n${"a".repeat(250)} ONLY_A`,
      "",
      "===== PAGE 2 =====",
      `Case 2: Beta\n${"b".repeat(250)} ONLY_B`
    ].join("\n");
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Official Casebook 2024",
      content,
      contentHash: sha256Content("casebook-1"),
      sourceFilename: "wharton.pdf"
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const llmClient = new FakeLlmClient({
      structuredResults: [
        { title: "Market entry", prompt: "Enter market", interviewerInfo: "hint", solution: "sol" },
        { title: "Profit", prompt: "Fix profit", interviewerInfo: "", solution: "done" }
      ]
    });

    await processImportJob(deps(llmClient, repository), "u1", job.id);

    const updated = await repository.getImportJob("u1", job.id);
    expect(updated?.status).toBe("done");
    expect(updated?.message).toMatch(/2 caseutkast/);
    const calls = llmClient.structuredCalls.map((call) => call.options.messages.find((message) => message.role === "user")?.content ?? "");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("ONLY_A");
    expect(calls[0]).not.toContain("ONLY_B");
    expect(calls[1]).toContain("ONLY_B");
    expect(calls[1]).not.toContain("ONLY_A");
    expect(calls.every((text) => text.length <= 12_000 + 80)).toBe(true);
    const state = JSON.parse(updated?.resultJson ?? "{}") as { chunks: Array<{ pageStart: number; pageEnd: number }> };
    expect(state.chunks.map((chunk) => [chunk.pageStart, chunk.pageEnd])).toEqual([
      [1, 1],
      [2, 2]
    ]);
    const cases = await repository.listCaseEntries("u1");
    expect(cases).toHaveLength(2);
    expect(cases.every((entry) => entry.approvalStatus === "pending")).toBe(true);
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
    const hash = sha256Content("Existing:prompt:solution");
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
        title: "Existing",
        prompt: "prompt",
        interviewerInfo: "",
        solution: "solution"
      }
    });

    await processImportJob(deps(llmClient, repository), "u1", job.id);

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

    await processImportJob(deps(llmClient, repository), "u1", job.id);

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

    await processImportJob(deps(llmClient, repository), "u1", job.id);

    expect((await repository.getImportJob("u1", job.id))?.status).toBe("failed");
    expect((await repository.getImportJob("u1", job.id))?.message).toMatch(/boom/);
  });

  it("resumes from the first unfinished chunk and keeps finished cases", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const content = [
      "===== PAGE 1 =====",
      `Case 1: Alpha\n${"a".repeat(250)}`,
      "",
      "===== PAGE 2 =====",
      `Case 2: Beta\n${"b".repeat(250)}`
    ].join("\n");
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "case",
      title: "Official Casebook 2024",
      content,
      contentHash: sha256Content("casebook-resume")
    });
    const job = await repository.createImportJob("u1", { knowledgeDocId: doc.id });
    const failing = new FakeLlmClient({
      structuredResult: { title: "Alpha", prompt: "første", interviewerInfo: "", solution: "en" }
    });
    let calls = 0;
    failing.completeStructured = async (options, schema) => {
      calls += 1;
      failing.structuredCalls.push({ options, schema });
      if (calls === 2) throw new Error("side 2 feilet");
      return schema.parse({ title: "Alpha", prompt: "første", interviewerInfo: "", solution: "en" });
    };

    await processImportJob(deps(failing, repository), "u1", job.id);
    expect((await repository.getImportJob("u1", job.id))?.status).toBe("failed");
    expect(await repository.listCaseEntries("u1")).toHaveLength(1);

    const retry = new FakeLlmClient({
      structuredResult: { title: "Beta", prompt: "andre", interviewerInfo: "hint", solution: "to" }
    });
    await processImportJob(deps(retry, repository), "u1", job.id);

    expect(retry.structuredCalls).toHaveLength(1);
    expect((await repository.getImportJob("u1", job.id))?.status).toBe("done");
    const cases = await repository.listCaseEntries("u1");
    expect(cases.map((entry) => entry.title).sort()).toEqual(["Alpha", "Beta"]);
  });

  it("cancels a queued job without a live runner", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const job = await repository.createImportJob("u1", { knowledgeDocId: "doc" });
    const registry = new JobCancellationRegistry();
    const result = await cancelImportJob({ repository, cancellationRegistry: registry }, "u1", job.id);
    expect(result.ok).toBe(true);
    expect((await repository.getImportJob("u1", job.id))?.status).toBe("cancelled");
  });
});
