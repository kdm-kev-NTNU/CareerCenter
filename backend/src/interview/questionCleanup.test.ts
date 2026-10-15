import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { processImportJob } from "./importJobService.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";
import { processQuestionCleanup } from "./questionCleanup.js";

const USER = "u1";

const DOC_CONTENT = [
  "2. Spørsmål de stiller deg",
  "Hvordan håndterer du uenighet i et team?",
  "Hva vet du om oss? Hvorfor vil du jobbe her?",
  "3. Spørsmål du stiller dem",
  "Hva overrasket deg mest det første året ditt her?",
  "Spørsmålet om gjennomtrekk stiller du slik: «Hva har gjort at du har blitt værende?»",
  "4. Instruks",
  "Spør alltid om en historie til?"
].join("\n");

async function seed(texts: string[], content = DOC_CONTENT) {
  const repository = new InterviewPrepMemoryRepository();
  const doc = await repository.createKnowledgeDoc(USER, {
    kind: "company",
    title: "Bedrift",
    content,
    contentHash: sha256Content(content)
  });
  await repository.insertBankQuestions(
    USER,
    doc.id,
    texts.map((text, i) => ({
      text,
      category: "company" as const,
      tags: ["company"],
      origin: "rule" as const,
      contentHash: sha256Content(`seed-${i}`)
    }))
  );
  const rows = await repository.listBankQuestions(USER, { knowledgeDocId: doc.id });
  const job = await repository.createImportJob(USER, { knowledgeDocId: doc.id, kind: "questions_cleanup" });
  const byText = (text: string) => rows.find((row) => row.text === text)!;
  return { repository, doc, job, rows, byText };
}

function part(text: string, audience = "candidate", category = "behavioral") {
  return { text, audience, category };
}

describe("processQuestionCleanup", () => {
  it("keeps, rewrites, splits and discards questions in place", async () => {
    const { repository, doc, job, byText } = await seed([
      "Hvordan håndterer du uenighet i et team?",
      "Hva vet du om oss? Hvorfor vil du jobbe her?",
      "Hva overrasket deg mest det første året ditt her?",
      "Spørsmålet om gjennomtrekk stiller du slik: «Hva har gjort at du har blitt værende?",
      "Spør alltid om en historie til?"
    ]);
    const disagreement = byText("Hvordan håndterer du uenighet i et team?");
    const compound = byText("Hva vet du om oss? Hvorfor vil du jobbe her?");
    const surprised = byText("Hva overrasket deg mest det første året ditt her?");
    const wrapped = byText("Spørsmålet om gjennomtrekk stiller du slik: «Hva har gjort at du har blitt værende?");
    const instruction = byText("Spør alltid om en historie til?");

    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          items: [
            { id: disagreement.id, action: "keep", parts: [part(disagreement.text)], discardReason: null },
            {
              id: compound.id,
              action: "split",
              parts: [
                part("Hva vet du om oss?", "candidate", "company"),
                part("Hvorfor vil du jobbe her?", "candidate", "motivation")
              ],
              discardReason: null
            },
            {
              id: surprised.id,
              action: "keep",
              parts: [part(surprised.text, "ask_interviewer_personal", "behavioral")],
              discardReason: null
            },
            {
              id: wrapped.id,
              action: "rewrite",
              parts: [part("«Hva har gjort at du har blitt værende?»", "ask_interviewer_personal", "personal")],
              discardReason: null
            },
            { id: instruction.id, action: "discard", parts: [], discardReason: "instruks_til_intervjuer" }
          ]
        }
      ]
    });

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);

    expect(llmClient.structuredCalls).toHaveLength(1);
    const userMessage = llmClient.structuredCalls[0]!.options.messages[1]!.content;
    expect(userMessage).toContain("overskrift: 3. Spørsmål du stiller dem");

    const all = await repository.listBankQuestions(USER, { status: "all" });
    const get = (id: string) => all.find((row) => row.id === id)!;

    expect(get(disagreement.id)).toMatchObject({ status: "active", audience: "candidate", category: "behavioral" });
    expect(get(compound.id)).toMatchObject({ text: "Hva vet du om oss?", category: "company" });
    const child = all.find((row) => row.text === "Hvorfor vil du jobbe her?")!;
    expect(child).toMatchObject({
      origin: "split",
      category: "motivation",
      sourceText: "Hva vet du om oss? Hvorfor vil du jobbe her?"
    });
    expect(child.cleanedAt).toBeTruthy();
    // Questions the candidate asks get a fixed category, whatever the model said.
    expect(get(surprised.id)).toMatchObject({ audience: "ask_interviewer_personal", category: "personal" });
    expect(get(wrapped.id)).toMatchObject({
      text: "Hva har gjort at du har blitt værende?",
      audience: "ask_interviewer_personal",
      sourceText: "Spørsmålet om gjennomtrekk stiller du slik: «Hva har gjort at du har blitt værende?"
    });
    expect(get(instruction.id)).toMatchObject({ status: "discarded", discardReason: "instruks_til_intervjuer" });
    expect(all.every((row) => row.cleanedAt)).toBe(true);

    const finished = await repository.getImportJob(USER, job.id);
    expect(finished).toMatchObject({ status: "done", progress: 100 });
    expect(finished!.message).toContain("1 forkastet, 2 omskrevet/delt");
  });

  it("discards duplicates of cleaned questions in other documents without an LLM call", async () => {
    const { repository, doc, job, byText } = await seed(["Hvordan håndterer du uenighet i et team?"]);
    const other = await repository.createKnowledgeDoc(USER, {
      kind: "core",
      title: "Kjerne",
      content: "x",
      contentHash: sha256Content("other")
    });
    await repository.insertBankQuestions(USER, other.id, [
      {
        text: "«Hvordan håndterer du  uenighet i et team?»",
        category: "behavioral",
        tags: [],
        origin: "rule",
        contentHash: sha256Content("other-q"),
        cleanedAt: new Date().toISOString()
      }
    ]);
    const llmClient = new FakeLlmClient();

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);

    expect(llmClient.structuredCalls).toHaveLength(0);
    const [row] = await repository.getBankQuestionsByIds(USER, [byText("Hvordan håndterer du uenighet i et team?").id]);
    expect(row).toMatchObject({ status: "discarded", discardReason: "duplikat" });
  });

  it("turns a rewrite that collides with an active question into a duplicate", async () => {
    const { repository, doc, job, byText } = await seed([
      "Hvordan håndterer du uenighet i et team?",
      "Spørsmålet stiller du slik: Hvordan håndterer du uenighet i et team?"
    ]);
    const original = byText("Hvordan håndterer du uenighet i et team?");
    const wrapped = byText("Spørsmålet stiller du slik: Hvordan håndterer du uenighet i et team?");
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          items: [
            { id: original.id, action: "keep", parts: [part(original.text)], discardReason: null },
            {
              id: wrapped.id,
              action: "rewrite",
              parts: [part("Hvordan håndterer du uenighet i et team?")],
              discardReason: null
            }
          ]
        }
      ]
    });

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);

    const rows = await repository.getBankQuestionsByIds(USER, [original.id, wrapped.id]);
    expect(rows.find((row) => row.id === original.id)).toMatchObject({ status: "active" });
    expect(rows.find((row) => row.id === wrapped.id)).toMatchObject({ status: "discarded", discardReason: "duplikat" });
  });

  it("leaves rows the model skipped uncleaned, and a second run makes no call when all are cleaned", async () => {
    const { repository, doc, job, byText } = await seed([
      "Hvordan håndterer du uenighet i et team?",
      "Hva overrasket deg mest det første året ditt her?"
    ]);
    const first = byText("Hvordan håndterer du uenighet i et team?");
    const skipped = byText("Hva overrasket deg mest det første året ditt her?");
    const llmClient = new FakeLlmClient({
      structuredResults: [
        { items: [{ id: first.id, action: "keep", parts: [part(first.text)], discardReason: null }] },
        {
          items: [
            {
              id: skipped.id,
              action: "keep",
              parts: [part(skipped.text, "ask_interviewer_personal", "personal")],
              discardReason: null
            }
          ]
        }
      ]
    });

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);
    expect((await repository.getBankQuestionsByIds(USER, [skipped.id]))[0]?.cleanedAt).toBeUndefined();

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);
    expect(llmClient.structuredCalls).toHaveLength(2);
    expect(llmClient.structuredCalls[1]!.options.messages[1]!.content).not.toContain(first.id);
    expect((await repository.getBankQuestionsByIds(USER, [skipped.id]))[0]?.cleanedAt).toBeTruthy();

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);
    expect(llmClient.structuredCalls).toHaveLength(2);
    expect(await repository.getImportJob(USER, job.id)).toMatchObject({
      status: "done",
      message: "Ingen spørsmål å rydde."
    });
  });

  it("marks the job failed when a batch errors and keeps those rows for the next run", async () => {
    const { repository, doc, job, rows } = await seed(["Hvordan håndterer du uenighet i et team?"]);
    const llmClient = new FakeLlmClient({ structuredError: new Error("rate limit") });

    await processQuestionCleanup({ llmClient, repository }, USER, job.id, doc, new AbortController().signal);

    const failed = await repository.getImportJob(USER, job.id);
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed!.message).toContain("1 spørsmål ble ikke ryddet: rate limit");
    expect((await repository.getBankQuestionsByIds(USER, [rows[0]!.id]))[0]?.cleanedAt).toBeUndefined();
  });

  it("stops on an aborted signal", async () => {
    const { repository, doc, job } = await seed(["Hvordan håndterer du uenighet i et team?"]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      processQuestionCleanup({ llmClient: new FakeLlmClient(), repository }, USER, job.id, doc, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("runs as an import job kind", async () => {
    const { repository, job, rows } = await seed(["Hvordan håndterer du uenighet i et team?"]);
    const llmClient = new FakeLlmClient({
      structuredResults: [
        { items: [{ id: rows[0]!.id, action: "keep", parts: [part(rows[0]!.text)], discardReason: null }] }
      ]
    });

    await processImportJob(
      { llmClient, repository, cancellationRegistry: new JobCancellationRegistry() },
      USER,
      job.id
    );

    expect(await repository.getImportJob(USER, job.id)).toMatchObject({ status: "done", progress: 100 });
  });
});
