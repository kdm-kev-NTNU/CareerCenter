import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { queueQuestionCleanup, runCleanupSerial, whenCleanupIdle } from "./importJobOrchestration.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";

async function seedDocWithQuestion(repository: InterviewPrepMemoryRepository, userId: string, title: string) {
  const doc = await repository.createKnowledgeDoc(userId, {
    kind: "core",
    title,
    content: `${title}: Hvorfor vil du jobbe her?`,
    contentHash: sha256Content(title)
  });
  await repository.insertBankQuestions(userId, doc.id, [
    {
      text: `${title}: Hvorfor vil du jobbe her?`,
      category: "motivation",
      tags: [],
      origin: "rule",
      contentHash: sha256Content(`${title}-q`)
    }
  ]);
  const [row] = await repository.listBankQuestions(userId, { knowledgeDocId: doc.id });
  return { doc, row: row! };
}

function keepResult(id: string, text: string) {
  return { items: [{ id, action: "keep", parts: [{ text, audience: "candidate", category: "motivation" }], discardReason: null }] };
}

describe("queueQuestionCleanup", () => {
  it("does nothing when AI is not configured", async () => {
    const repository = new InterviewPrepMemoryRepository();
    await seedDocWithQuestion(repository, "u-off", "A");
    const deps = {
      repository,
      llmClient: new FakeLlmClient({ configured: false }),
      cancellationRegistry: new JobCancellationRegistry()
    };
    expect(await queueQuestionCleanup(deps, "u-off")).toEqual([]);
    expect(await repository.listImportJobs("u-off")).toHaveLength(0);
  });

  it("queues one job per document with uncleaned questions, runs them in turn and reuses finished jobs", async () => {
    const userId = "u-queue";
    const repository = new InterviewPrepMemoryRepository();
    const a = await seedDocWithQuestion(repository, userId, "A");
    const b = await seedDocWithQuestion(repository, userId, "B");
    const llmClient = new FakeLlmClient({
      structuredResults: [keepResult(a.row.id, a.row.text), keepResult(b.row.id, b.row.text)]
    });
    const deps = { repository, llmClient, cancellationRegistry: new JobCancellationRegistry() };

    const queued = await queueQuestionCleanup(deps, userId);
    expect(queued.map((job) => job.knowledgeDocId).sort()).toEqual([a.doc.id, b.doc.id].sort());
    // Already queued: no duplicate jobs.
    expect(await queueQuestionCleanup(deps, userId, [a.doc.id])).toEqual([]);

    await whenCleanupIdle(userId);
    const jobs = await repository.listImportJobs(userId);
    expect(jobs.filter((job) => job.kind === "questions_cleanup")).toHaveLength(2);
    expect(jobs.every((job) => job.status === "done")).toBe(true);
    expect((await repository.summarizeBankQuestions(userId)).uncleaned).toBe(0);

    // Nothing left to clean: nothing queued.
    expect(await queueQuestionCleanup(deps, userId)).toEqual([]);

    // New uncleaned rows reuse the finished job for that document.
    await repository.resetBankQuestionCleanup(userId);
    const requeued = await queueQuestionCleanup(deps, userId, [a.doc.id]);
    expect(requeued).toHaveLength(1);
    expect(requeued[0]!.id).toBe(jobs.find((job) => job.knowledgeDocId === a.doc.id)!.id);
    await whenCleanupIdle(userId);
  });
});

describe("runCleanupSerial", () => {
  it("runs tasks for one user one after another, also after a failure", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    void runCleanupSerial("u-serial", async () => {
      await gate;
      order.push("first");
      throw new Error("boom");
    });
    const second = runCleanupSerial("u-serial", async () => {
      order.push("second");
    });
    expect(order).toEqual([]);
    release();
    await second;
    expect(order).toEqual(["first", "second"]);
  });
});
