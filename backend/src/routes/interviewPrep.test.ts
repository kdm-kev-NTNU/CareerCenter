import { starRubricCriteria } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { sha256Content } from "../interview/contentHash.js";
import { MemoryRepository } from "../memoryRepository.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { buildServer } from "../server.js";

async function waitForPlanStatus(
  app: {
    inject: (opts: { method: string; url: string }) => Promise<{
      json: () => {
        plan: {
          status: string;
          pipelineStep: string;
          failureReason?: string;
          clarifications: Array<{ id: string }>;
          questions: unknown[];
        };
      };
    }>;
  },
  planId: string,
  status: string
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/interview/plans/${planId}` });
    const plan = response.json().plan;
    if (plan.status === status) return plan;
    if (plan.status === "failed") {
      throw new Error(plan.failureReason ?? "Plan feilet.");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Tidsavbrudd mens planen skulle bli ${status}.`);
}

describe("interview prep routes", () => {
  async function seedBank(repo: InterviewPrepMemoryRepository, userId = "__test__") {
    const doc = await repo.createKnowledgeDoc(userId, {
      kind: "star",
      title: "Bank",
      content: "seed",
      contentHash: sha256Content(`seed-${Math.random()}`)
    });
    await repo.insertBankQuestions(
      userId,
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: `Seeded question ${i}?`,
        category: "behavioral" as const,
        tags: ["seed"],
        origin: "rule" as const,
        contentHash: sha256Content(`seed-q-${doc.id}-${i}`)
      }))
    );
    return repo.listBankQuestions(userId);
  }

  async function buildInterviewApp(options: {
    structuredResult?: unknown;
    structuredResults?: unknown[];
    structuredError?: Error;
    configured?: boolean;
    transcribeResult?: string;
    repo?: InterviewPrepMemoryRepository;
  } = {}) {
    const interviewPrepRepository = options.repo ?? new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      configured: options.configured ?? true,
      transcribeResult: options.transcribeResult ?? "Jeg ledet et prosjekt som reduserte feil med 20%.",
      structuredResult: options.structuredResult ?? {
        clarifications: [{ question: "Hvilken rolle?" }],
        scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 3])),
        sum: 24,
        improvement: "ok"
      },
      structuredResults: options.structuredResults,
      structuredError: options.structuredError
    });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository
    });
    await app.ready();
    return { app, interviewPrepRepository, llmClient };
  }

  function multipartPayload(
    boundary: string,
    fields: Record<string, string>,
    file?: { filename: string; contentType: string; body: string }
  ) {
    let payload = "";
    for (const [name, value] of Object.entries(fields)) {
      payload +=
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
        `${value}\r\n`;
    }
    if (file) {
      payload +=
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n` +
        `${file.body}\r\n`;
    }
    payload += `--${boundary}--\r\n`;
    return payload;
  }

  it("returns AI configuration status", async () => {
    const { app } = await buildInterviewApp();
    const response = await app.inject({ method: "GET", url: "/api/interview/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ aiConfigured: true });
    await app.close();
  });

  it("creates knowledge and hides case secrets in list", async () => {
    const { app } = await buildInterviewApp();
    const knowledge = await app.inject({
      method: "POST",
      url: "/api/interview/knowledge",
      payload: { title: "Case notes", content: "Prompt:\nGrow revenue\nSolution:\nSecret" }
    });
    expect(knowledge.statusCode).toBe(201);

    const caseRes = await app.inject({
      method: "POST",
      url: "/api/interview/cases",
      payload: {
        title: "Profit case",
        prompt: "Grow revenue",
        interviewerInfo: "hidden",
        solution: "secret sauce",
        sourceKind: "single_case"
      }
    });
    expect(caseRes.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/api/interview/cases" });
    const body = list.json() as Array<Record<string, unknown>>;
    expect(body[0]).not.toHaveProperty("solution");
    expect(body[0]).not.toHaveProperty("interviewerInfo");
    expect(body[0]?.prompt).toBe("Grow revenue");

    const detail = await app.inject({ method: "GET", url: `/api/interview/cases/${body[0]?.id as string}` });
    expect(detail.json()).toMatchObject({ solution: "secret sauce", interviewerInfo: "hidden" });
    await app.close();
  });

  it("deduplicates knowledge by content hash", async () => {
    const { app } = await buildInterviewApp();
    const first = await app.inject({
      method: "POST",
      url: "/api/interview/knowledge",
      payload: { title: "A", content: "same" }
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/interview/knowledge",
      payload: { title: "B", content: "same" }
    });
    expect(first.json().deduplicated).toBe(false);
    expect(second.json().deduplicated).toBe(true);
    await app.close();
  });

  it("runs prep plan research and finish session rubric", async () => {
    const mainRepo = new MemoryRepository();
    const interviewPrepRepository = new InterviewPrepMemoryRepository();
    // Ensure auth-disabled user exists so we can seed the bank under the real id.
    const pinHash = "x";
    const user = await mainRepo.createUser("__test__", pinHash);
    await mainRepo.initializeNewUser(user.id);
    const bank = await seedBank(interviewPrepRepository, user.id);

    const llmClient = new FakeLlmClient({
      configured: true,
      structuredResult: {
        scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 4])),
        sum: 32,
        improvement: "Fortsett slik."
      },
      structuredResults: [
        {
          industries: ["banking"],
          businessAreas: [],
          interviewFormats: ["behavioral"],
          caseTypes: [],
          values: [],
          themes: ["leadership"],
          summary: "profile"
        },
        {
          headline: "DNB",
          keyFacts: {},
          aboutCompany: "",
          businessAreas: [],
          strategyAndNews: [],
          cultureAndValues: [],
          roleInContext: "",
          jobAdRequirements: [],
          nicheInsights: ["Nordisk markets"],
          companyQuestionPrep: [
            {
              question: "Hvorfor DNB?",
              answerAngle: "Koble til nordisk franchise.",
              nicheHooks: ["Nordisk markets"]
            }
          ],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        },
        { clarifications: [{ question: "Hvilken rolle?" }] },
        {
          selectedQuestionIds: bank.map((q) => q.id),
          generatedQuestions: [],
          tasks: [{ title: "Les årsrapport", description: "" }]
        }
      ]
    });
    const app = await buildServer({
      repository: mainRepo,
      authDisabled: true,
      llmClient,
      interviewPrepRepository
    });
    await app.ready();

    const planRes = await app.inject({
      method: "POST",
      url: "/api/interview/plans",
      payload: {
        companyName: "DNB",
        roleTitle: "Associate",
        format: "interview",
        researchModel: "gpt-5.5",
        jobAdText: "Vi søker en associate i Markets."
      }
    });
    expect(planRes.statusCode).toBe(201);
    expect(planRes.json().researchModel).toBe("gpt-5.5");
    expect(planRes.json().jobAdText).toContain("Markets");
    const planId = planRes.json().id as string;

    const research = await app.inject({ method: "POST", url: `/api/interview/plans/${planId}/research` });
    expect(research.statusCode).toBe(202);
    const researched =
      research.json().status === "awaiting_answers"
        ? research.json()
        : await waitForPlanStatus(app, planId, "awaiting_answers");
    expect(researched.pipelineStep).toBe("awaiting_answers");
    expect(researched.companyReport?.headline).toBe("DNB");

    const clarifications = researched.clarifications as Array<{ id: string }>;
    const curated = await app.inject({
      method: "POST",
      url: `/api/interview/plans/${planId}/clarifications`,
      payload: { answers: [{ id: clarifications[0]!.id, answer: "Tech" }] }
    });
    expect(curated.statusCode).toBe(202);
    const ready =
      curated.json().status === "ready" ? curated.json() : await waitForPlanStatus(app, planId, "ready");
    expect(ready.questions.length).toBeGreaterThanOrEqual(30);
    expect(ready.pipelineStep).toBe("ready");

    const session = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", title: "Mock" }
    });
    const sessionId = session.json().id as string;

    await app.inject({
      method: "POST",
      url: `/api/interview/sessions/${sessionId}/messages`,
      payload: { content: "Jeg ledet et team som økte salget med 10%." }
    });

    const finished = await app.inject({ method: "POST", url: `/api/interview/sessions/${sessionId}/finish` });
    expect(finished.statusCode).toBe(200);
    expect(finished.json().feedback.sum).toBe(32);
    await app.close();
  });

  it("sends full role-labeled transcript to finish rubric, not only last user message", async () => {
    const interviewPrepRepository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      configured: true,
      completeResult: "Fortell om en gang du gjorde en feil.",
      structuredResult: {
        scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 3])),
        sum: 24,
        improvement: "Si strukturen opp front."
      }
    });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository
    });
    await app.ready();

    const session = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", title: "Transcript rubric" }
    });
    const sessionId = session.json().id as string;

    await app.inject({
      method: "POST",
      url: `/api/interview/sessions/${sessionId}/transcript`,
      payload: { role: "assistant", content: "Fortell om en gang du gjorde en feil." }
    });
    await app.inject({
      method: "POST",
      url: `/api/interview/sessions/${sessionId}/transcript`,
      payload: { role: "user", content: "Jeg glemte en deadline i SpareBank 1." }
    });

    const finished = await app.inject({ method: "POST", url: `/api/interview/sessions/${sessionId}/finish` });
    expect(finished.statusCode).toBe(200);

    const rubricCall = llmClient.structuredCalls.at(-1);
    expect(rubricCall).toBeDefined();
    const userContent = rubricCall!.options.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userContent).toContain("Intervjuer: Fortell om en gang du gjorde en feil.");
    expect(userContent).toContain("Kandidat: Jeg glemte en deadline i SpareBank 1.");
    expect(userContent).not.toBe("Jeg glemte en deadline i SpareBank 1.");
    await app.close();
  });

  it("refuses to finish a session without AI, so every session stays scored", async () => {
    const { app, llmClient } = await buildInterviewApp({ configured: false });
    const session = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", title: "Test", practice: true }
    });
    expect(session.statusCode).toBe(201);
    expect(session.json()).not.toHaveProperty("practice");
    const sessionId = session.json().id as string;

    const finished = await app.inject({ method: "POST", url: `/api/interview/sessions/${sessionId}/finish` });
    expect(finished.statusCode).toBe(503);
    expect(llmClient.structuredCalls).toHaveLength(0);
    const stored = await app.inject({ method: "GET", url: "/api/interview/sessions" });
    const row = (stored.json() as Array<{ id: string; finishedAt?: string; feedback?: unknown }>).find(
      (item) => item.id === sessionId
    );
    expect(row?.finishedAt).toBeUndefined();
    expect(row?.feedback).toBeUndefined();
    await app.close();
  });

  it("transcribes multipart audio and rates with prompt context", async () => {
    const rubric = {
      scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 4])),
      sum: 32,
      improvement: "Bra tempo."
    };
    const { app, llmClient } = await buildInterviewApp({
      structuredResult: rubric,
      transcribeResult: "Jeg leverte funksjonen før deadline."
    });
    const boundary = "----VideoTranscribeBoundary";
    const response = await app.inject({
      method: "POST",
      url: "/api/interview/video/transcribe",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipartPayload(
        boundary,
        {
          prompt: "Fortell om en gang du leverte under press.",
          withRubric: "true",
          durationMs: "45000"
        },
        { filename: "answer.webm", contentType: "audio/webm", body: "fake-audio-bytes" }
      )
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().transcript).toBe("Jeg leverte funksjonen før deadline.");
    expect(response.json().feedback.sum).toBe(32);
    expect(response.json().feedbackFallback).toBe(false);
    expect(llmClient.transcribeCalls).toHaveLength(1);
    expect(llmClient.transcribeCalls[0]!.buffer.toString()).toContain("fake-audio-bytes");
    const rubricUser = llmClient.structuredCalls.at(-1)?.options.messages.find((m) => m.role === "user")?.content;
    expect(rubricUser).toContain("Spørsmål: Fortell om en gang du leverte under press.");
    expect(rubricUser).toContain("Svar: Jeg leverte funksjonen før deadline.");
    await app.close();
  });

  it("marks feedbackFallback when rubric AI fails", async () => {
    const { app } = await buildInterviewApp({
      structuredError: new Error("rubric down"),
      transcribeResult: "Et kort svar."
    });
    const boundary = "----VideoFallbackBoundary";
    const response = await app.inject({
      method: "POST",
      url: "/api/interview/video/transcribe",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipartPayload(
        boundary,
        { prompt: "Hvorfor deg?", withRubric: "true" },
        { filename: "answer.webm", contentType: "audio/webm", body: "audio" }
      )
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().feedbackFallback).toBe(true);
    expect(response.json().feedback.sum).toBe(24);
    await app.close();
  });

  it("exposes voice session mock and saves transcript messages", async () => {
    const { app } = await buildInterviewApp();
    const session = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", title: "Voice stub" }
    });
    const sessionId = session.json().id as string;

    const voice = await app.inject({
      method: "POST",
      url: "/api/interview/voice/session",
      payload: { sessionId }
    });
    expect(voice.statusCode).toBe(200);
    expect(voice.json().mock).toBe(true);
    expect(JSON.stringify(voice.json())).not.toContain("sk-");

    const userLine = await app.inject({
      method: "POST",
      url: `/api/interview/sessions/${sessionId}/transcript`,
      payload: { role: "user", content: "Hei, jeg er klar." }
    });
    expect(userLine.statusCode).toBe(200);
    expect(userLine.json().role).toBe("user");

    const assistantLine = await app.inject({
      method: "POST",
      url: `/api/interview/sessions/${sessionId}/transcript`,
      payload: { role: "assistant", content: "Fortell om en utfordring du løste." }
    });
    expect(assistantLine.json().role).toBe("assistant");
    await app.close();
  });

  it("records ability attempts", async () => {
    const { app } = await buildInterviewApp();
    const attempt = await app.inject({
      method: "POST",
      url: "/api/interview/ability/attempts",
      payload: { kind: "switch_challenge", seed: 42, correct: true, durationMs: 12000 }
    });
    expect(attempt.statusCode).toBe(201);
    await app.close();
  });

  it("retries a failed import job and rejects a job that is still running", async () => {
    const mainRepo = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const user = await mainRepo.createUser("__test__", "x");
    const doc = await repo.createKnowledgeDoc(user.id, {
      kind: "case",
      title: "Official Casebook",
      content: `===== PAGE 1 =====\nCase 1: Alpha\n${"a".repeat(250)}`,
      contentHash: sha256Content("retry-doc"),
      sourceFilename: "book.pdf"
    });
    const job = await repo.createImportJob(user.id, { knowledgeDocId: doc.id });
    await repo.updateImportJob(user.id, job.id, { status: "running", message: "pågår" });
    const app = await buildServer({
      repository: mainRepo,
      authDisabled: true,
      skipJobRecovery: true,
      llmClient: new FakeLlmClient({
        structuredResult: { title: "Alpha", prompt: "prompten", interviewerInfo: "", solution: "løsningen" }
      }),
      interviewPrepRepository: repo
    });
    await app.ready();

    const blocked = await app.inject({ method: "POST", url: `/api/interview/import-jobs/${job.id}/retry` });
    expect(blocked.statusCode).toBe(409);

    await repo.updateImportJob(user.id, job.id, { status: "failed", message: "boom" });
    const retry = await app.inject({ method: "POST", url: `/api/interview/import-jobs/${job.id}/retry` });
    expect(retry.statusCode).toBe(200);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await repo.getImportJob(user.id, job.id);
      if (current?.status === "done") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const finished = await repo.getImportJob(user.id, job.id);
    expect(finished?.status).toBe("done");
    expect(finished?.message).toMatch(/caseutkast/);
    const state = JSON.parse(finished?.resultJson ?? "{}") as { chunks: Array<{ pageStart: number; status: string }> };
    expect(state.chunks[0]).toMatchObject({ pageStart: 1, status: "done" });
    await app.close();
  });

  it("deletes stopped and finished import jobs and keeps the document", async () => {
    const mainRepo = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const user = await mainRepo.createUser("__test__", "x");
    const doc = await repo.createKnowledgeDoc(user.id, {
      kind: "case",
      title: "Official Casebook",
      content: "Case 1: Alpha",
      contentHash: sha256Content("delete-doc"),
      sourceFilename: "book.pdf"
    });
    const running = await repo.createImportJob(user.id, { knowledgeDocId: doc.id });
    await repo.updateImportJob(user.id, running.id, { status: "running" });
    const cancelled = await repo.createImportJob(user.id, { knowledgeDocId: doc.id, kind: "questions" });
    await repo.updateImportJob(user.id, cancelled.id, { status: "cancelled", message: "Stoppet av bruker" });
    const done = await repo.createImportJob(user.id, { knowledgeDocId: doc.id });
    await repo.updateImportJob(user.id, done.id, { status: "done", progress: 100 });

    const app = await buildServer({
      repository: mainRepo,
      authDisabled: true,
      skipJobRecovery: true,
      interviewPrepRepository: repo
    });
    await app.ready();

    const blocked = await app.inject({ method: "DELETE", url: `/api/interview/import-jobs/${running.id}` });
    expect(blocked.statusCode).toBe(409);
    expect(await repo.getImportJob(user.id, running.id)).toBeTruthy();

    const missing = await app.inject({ method: "DELETE", url: "/api/interview/import-jobs/missing" });
    expect(missing.statusCode).toBe(404);

    const removedCancelled = await app.inject({ method: "DELETE", url: `/api/interview/import-jobs/${cancelled.id}` });
    expect(removedCancelled.statusCode).toBe(204);
    expect(await repo.getImportJob(user.id, cancelled.id)).toBeNull();

    const removedDone = await app.inject({ method: "DELETE", url: `/api/interview/import-jobs/${done.id}` });
    expect(removedDone.statusCode).toBe(204);
    expect(await repo.getImportJob(user.id, done.id)).toBeNull();

    const docs = await repo.listKnowledgeDocs(user.id);
    expect(docs.map((item) => item.id)).toContain(doc.id);
    await app.close();
  });

  it("starts a practice session from a ready plan and rejects non-ready plans", async () => {
    const main = new MemoryRepository();
    const interviewRepo = new InterviewPrepMemoryRepository();
    const app = await buildServer({
      repository: main,
      authDisabled: true,
      llmClient: new FakeLlmClient({ configured: true }),
      interviewPrepRepository: interviewRepo
    });
    await app.ready();
    await app.inject({ method: "GET", url: "/api/interview/status" });
    const user = await main.findUserByName("__test__");
    expect(user).toBeTruthy();

    const plan = await interviewRepo.createPrepPlan(user!.id, {
      companyName: "DNB",
      roleTitle: "Analyst",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await interviewRepo.setPrepPlanCurated(user!.id, plan.id, {
      questions: [
        {
          text: "Why DNB?",
          category: "motivation",
          target: "interview",
          source: "custom"
        }
      ],
      tasks: []
    });
    await interviewRepo.updatePrepPlanStatus(user!.id, plan.id, "ready");

    const created = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", prepPlanId: plan.id }
    });
    expect(created.statusCode).toBe(201);
    const session = created.json() as { id: string };
    const messages = await app.inject({
      method: "GET",
      url: `/api/interview/sessions/${session.id}/messages`
    });
    const system = (messages.json() as Array<{ role: string; content: string }>).find((m) => m.role === "system");
    expect(system?.content).toContain("Why DNB?");
    expect(system?.content).toContain("øvingsplan");

    const draftPlan = await interviewRepo.createPrepPlan(user!.id, {
      companyName: "X",
      roleTitle: "Y",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    const notReady = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", prepPlanId: draftPlan.id }
    });
    expect(notReady.statusCode).toBe(409);

    const voice = await app.inject({
      method: "POST",
      url: "/api/interview/voice/session",
      payload: { sessionId: session.id }
    });
    expect(voice.statusCode).toBe(200);
    expect(voice.json()).toMatchObject({ mock: true });
    await app.close();
  });

  it("edits plan questions and rejects incomplete reorder", async () => {
    const main = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const app = await buildServer({
      repository: main,
      authDisabled: true,
      llmClient: new FakeLlmClient({ configured: true }),
      interviewPrepRepository: repo
    });
    await app.ready();
    await app.inject({ method: "GET", url: "/api/interview/status" });
    const user = await main.findUserByName("__test__");
    expect(user).toBeTruthy();

    const plan = await repo.createPrepPlan(user!.id, {
      companyName: "DNB",
      roleTitle: "Analyst",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated(user!.id, plan.id, {
      questions: [
        { text: "A?", category: "behavioral", target: "interview", source: "generated" },
        { text: "B?", category: "behavioral", target: "interview", source: "generated" }
      ],
      tasks: []
    });
    const ready = await repo.getPrepPlan(user!.id, plan.id);
    const [q1, q2] = ready!.questions;

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/interview/plans/${plan.id}/questions/${q1!.id}`,
      payload: { text: "A edited?", notes: "STAR", included: false }
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().questions.find((q: { id: string }) => q.id === q1!.id)).toMatchObject({
      text: "A edited?",
      notes: "STAR",
      included: false,
      source: "edited"
    });

    const badOrder = await app.inject({
      method: "PUT",
      url: `/api/interview/plans/${plan.id}/questions/order`,
      payload: { orderedIds: [q1!.id] }
    });
    expect(badOrder.statusCode).toBe(400);

    const reordered = await app.inject({
      method: "PUT",
      url: `/api/interview/plans/${plan.id}/questions/order`,
      payload: { orderedIds: [q2!.id, q1!.id] }
    });
    expect(reordered.statusCode).toBe(200);
    expect(reordered.json().questions.map((q: { id: string }) => q.id)).toEqual([q2!.id, q1!.id]);
    await app.close();
  });

  it("serves company report PDF when report exists and 404 otherwise", async () => {
    const main = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const app = await buildServer({
      repository: main,
      authDisabled: true,
      llmClient: new FakeLlmClient({ configured: true }),
      interviewPrepRepository: repo
    });
    await app.ready();
    await app.inject({ method: "GET", url: "/api/interview/status" });
    const user = await main.findUserByName("__test__");
    expect(user).toBeTruthy();

    const plan = await repo.createPrepPlan(user!.id, {
      companyName: "DNB ASA",
      roleTitle: "Associate",
      format: "interview",
      researchModel: "gpt-6-astra",
      jobAdText: "Vi søker en associate."
    });

    const missing = await app.inject({
      method: "GET",
      url: `/api/interview/plans/${plan.id}/company-report.pdf`
    });
    expect(missing.statusCode).toBe(404);

    await repo.setPrepPlanPipeline(user!.id, plan.id, {
      pipelineStep: "awaiting_answers",
      companyReportJson: JSON.stringify({
        headline: "DNB – kort oversikt",
        keyFacts: { industry: "Bank" },
        aboutCompany: "Norges største bank.",
        businessAreas: ["Privat"],
        strategyAndNews: [],
        cultureAndValues: ["Integritet"],
        roleInContext: "Associate",
        jobAdRequirements: [],
        nicheInsights: ["Nordisk markets"],
        companyQuestionPrep: [
          {
            question: "Hvorfor DNB?",
            answerAngle: "Koble til nordisk franchise.",
            nicheHooks: ["Nordisk markets"]
          }
        ],
        interviewAngles: [],
        questionsToAsk: [],
        sources: []
      })
    });

    const pdf = await app.inject({
      method: "GET",
      url: `/api/interview/plans/${plan.id}/company-report.pdf`
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.headers["content-disposition"]).toMatch(/attachment; filename=".*bedriftsrapport\.pdf"/);
    expect(pdf.rawPayload.subarray(0, 4).toString("utf8")).toBe("%PDF");

    // authDisabled uses __test__; a plan owned by another user must 404.
    const otherUser = await main.createUser("other", "x");
    const otherPlan = await repo.createPrepPlan(otherUser.id, {
      companyName: "Secret",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanPipeline(otherUser.id, otherPlan.id, {
      pipelineStep: "ready",
      companyReportJson: JSON.stringify({
        headline: "Secret",
        keyFacts: {},
        aboutCompany: "",
        businessAreas: [],
        strategyAndNews: [],
        cultureAndValues: [],
        roleInContext: "",
        jobAdRequirements: [],
        nicheInsights: [],
        companyQuestionPrep: [],
        interviewAngles: [],
        questionsToAsk: [],
        sources: []
      })
    });
    const denied = await app.inject({
      method: "GET",
      url: `/api/interview/plans/${otherPlan.id}/company-report.pdf`
    });
    expect(denied.statusCode).toBe(404);
    await app.close();
  });

  it("recovers interrupted import jobs on server start", async () => {
    const mainRepo = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const user = await mainRepo.createUser("__test__", "x");
    const doc = await repo.createKnowledgeDoc(user.id, {
      kind: "case",
      title: "Stuck",
      content: "x",
      contentHash: sha256Content("stuck")
    });
    const job = await repo.createImportJob(user.id, { knowledgeDocId: doc.id });
    await repo.updateImportJob(user.id, job.id, { status: "running", message: "pågår" });
    const plan = await repo.createPrepPlan(user.id, {
      companyName: "Y",
      roleTitle: "Z",
      format: "interview",
      researchModel: "gpt-6-luna"
    });
    await repo.updatePrepPlanStatus(user.id, plan.id, "researching");

    const app = await buildServer({
      repository: mainRepo,
      authDisabled: true,
      interviewPrepRepository: repo,
      llmClient: new FakeLlmClient()
    });
    await app.ready();

    expect((await repo.getImportJob(user.id, job.id))?.status).toBe("failed");
    expect((await repo.getImportJob(user.id, job.id))?.message).toMatch(/omstart/i);
    expect((await repo.getPrepPlan(user.id, plan.id))?.status).toBe("failed");
    await app.close();
  });
});

describe("question bank and essentials routes", () => {
  async function setup(options: { configured?: boolean; structuredResults?: unknown[] } = {}) {
    const main = new MemoryRepository();
    const repo = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      configured: options.configured ?? true,
      structuredResults: options.structuredResults
    });
    const app = await buildServer({
      repository: main,
      authDisabled: true,
      llmClient,
      interviewPrepRepository: repo
    });
    await app.ready();
    await app.inject({ method: "GET", url: "/api/interview/status" });
    const user = await main.findUserByName("__test__");
    return { app, repo, llmClient, userId: user!.id };
  }

  async function seedQuestions(repo: InterviewPrepMemoryRepository, userId: string) {
    const doc = await repo.createKnowledgeDoc(userId, {
      kind: "company",
      title: "Bedrift",
      content: "x",
      contentHash: sha256Content(`bank-${Math.random()}`)
    });
    await repo.insertBankQuestions(userId, doc.id, [
      { text: "Hva vet du om oss?", category: "company", tags: [], origin: "rule", contentHash: sha256Content("a") },
      {
        text: "Hva overrasket deg mest?",
        category: "personal",
        audience: "ask_interviewer_personal",
        tags: [],
        origin: "rule",
        contentHash: sha256Content("b")
      }
    ]);
    const rows = await repo.listBankQuestions(userId);
    return { doc, rows, byText: (text: string) => rows.find((row) => row.text === text)! };
  }

  function keepAll(rows: Array<{ id: string; text: string; audience: string; category: string }>) {
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: "keep",
        parts: [{ text: row.text, audience: row.audience, category: row.category }],
        discardReason: null
      }))
    };
  }

  it("filters, edits, discards and restores bank questions", async () => {
    const { app, repo, userId } = await setup();
    const { byText } = await seedQuestions(repo, userId);
    const ours = byText("Hva vet du om oss?");

    const reverse = await app.inject({
      method: "GET",
      url: "/api/interview/questions?audience=ask_interviewer_personal"
    });
    expect(reverse.json().map((q: { text: string }) => q.text)).toEqual(["Hva overrasket deg mest?"]);

    const moved = await app.inject({
      method: "PATCH",
      url: `/api/interview/questions/${ours.id}`,
      payload: { audience: "ask_interviewer_company", category: "behavioral" }
    });
    expect(moved.statusCode).toBe(200);
    expect(moved.json()).toMatchObject({ audience: "ask_interviewer_company", category: "company", origin: "manual" });
    expect(moved.json().cleanedAt).toBeTruthy();

    const missing = await app.inject({
      method: "PATCH",
      url: "/api/interview/questions/nope",
      payload: { text: "Ny tekst?" }
    });
    expect(missing.statusCode).toBe(404);
    const empty = await app.inject({ method: "PATCH", url: `/api/interview/questions/${ours.id}`, payload: {} });
    expect(empty.statusCode).toBe(400);

    const discarded = await app.inject({
      method: "POST",
      url: `/api/interview/questions/${ours.id}/discard`,
      payload: {}
    });
    expect(discarded.json()).toMatchObject({ status: "discarded", discardReason: "manuelt" });
    const active = await app.inject({ method: "GET", url: "/api/interview/questions" });
    expect(active.json().some((q: { id: string }) => q.id === ours.id)).toBe(false);
    const bin = await app.inject({ method: "GET", url: "/api/interview/questions?status=discarded" });
    expect(bin.json().map((q: { id: string }) => q.id)).toEqual([ours.id]);

    const summary = await app.inject({ method: "GET", url: "/api/interview/questions/summary" });
    expect(summary.json()).toEqual({
      byAudience: { candidate: 0, ask_interviewer_personal: 1, ask_interviewer_company: 0 },
      discarded: 1,
      uncleaned: 1
    });

    const restored = await app.inject({ method: "POST", url: `/api/interview/questions/${ours.id}/restore` });
    expect(restored.json()).toMatchObject({ status: "active" });
    expect(restored.json().discardReason).toBeUndefined();
    await app.close();
  });

  it("rejects swapping in a discarded bank question and fixes the category of added questions to ask", async () => {
    const { app, repo, userId } = await setup();
    const { byText } = await seedQuestions(repo, userId);
    const question = byText("Hva vet du om oss?");
    await repo.updateBankQuestion(userId, question.id, { status: "discarded", discardReason: "tips" });
    const plan = await repo.createPrepPlan(userId, {
      companyName: "DNB",
      roleTitle: "",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated(userId, plan.id, {
      questions: [{ text: "A?", category: "behavioral", target: "interview", source: "generated" }],
      tasks: []
    });
    const ready = await repo.getPrepPlan(userId, plan.id);
    const swap = await app.inject({
      method: "PUT",
      url: `/api/interview/plans/${plan.id}/questions/${ready!.questions[0]!.id}`,
      payload: { bankQuestionId: question.id }
    });
    expect(swap.statusCode).toBe(400);

    const added = await app.inject({
      method: "POST",
      url: `/api/interview/plans/${plan.id}/questions`,
      payload: { text: "Hvordan jobber dere med KI?", category: "behavioral", audience: "ask_interviewer_company" }
    });
    expect(added.statusCode).toBe(201);
    expect(added.json().questions.at(-1)).toMatchObject({ audience: "ask_interviewer_company", category: "company" });
    await app.close();
  });

  it("refuses the cleanup agent without AI", async () => {
    const { app } = await setup({ configured: false });
    const refused = await app.inject({ method: "POST", url: "/api/interview/questions/cleanup", payload: {} });
    expect(refused.statusCode).toBe(503);
    await app.close();
  });

  it("queues the cleanup agent, and queues again after a reset", async () => {
    // FakeLlmClient keeps this array by reference, so results can be added once row ids exist.
    const results: unknown[] = [];
    const { app, repo, userId, llmClient } = await setup({ structuredResults: results });
    const { rows } = await seedQuestions(repo, userId);
    results.push(keepAll(rows), keepAll(rows));

    const queued = await app.inject({ method: "POST", url: "/api/interview/questions/cleanup", payload: {} });
    expect(queued.statusCode).toBe(200);
    expect(queued.json().queuedJobs).toHaveLength(1);
    await waitForUncleaned(repo, userId, 0);

    const nothing = await app.inject({ method: "POST", url: "/api/interview/questions/cleanup", payload: {} });
    expect(nothing.json()).toMatchObject({ queuedJobs: [], message: "Alle spørsmål er ryddet." });

    const reset = await app.inject({
      method: "POST",
      url: "/api/interview/questions/cleanup",
      payload: { reset: true }
    });
    expect(reset.json().queuedJobs).toHaveLength(1);
    await waitForUncleaned(repo, userId, 0);
    expect(llmClient.structuredCalls).toHaveLength(2);
    await app.close();
  });

  it("queues cleanup after a knowledge document with questions is saved, only when AI is on", async () => {
    const off = await setup({ configured: false });
    await off.app.inject({
      method: "POST",
      url: "/api/interview/knowledge",
      payload: { title: "Notater", content: "Hvorfor vil du jobbe her?" }
    });
    expect(await off.repo.listImportJobs(off.userId)).toHaveLength(0);
    await off.app.close();

    const { app, repo, userId } = await setup();
    await app.inject({
      method: "POST",
      url: "/api/interview/knowledge",
      payload: { title: "Notater", content: "Hvorfor vil du jobbe her?" }
    });
    const jobs = await repo.listImportJobs(userId);
    expect(jobs.map((job) => job.kind)).toEqual(["questions_cleanup"]);
    await waitForUncleaned(repo, userId, 1);
    await app.close();
  });

  it("reindexes twice without failing when documents share a question", async () => {
    const { app } = await setup({ configured: false });
    for (const title of ["A", "B"]) {
      await app.inject({
        method: "POST",
        url: "/api/interview/knowledge",
        payload: { title, content: `${title}\nHva gjør du på fritiden?` }
      });
    }
    for (let i = 0; i < 2; i += 1) {
      const response = await app.inject({ method: "POST", url: "/api/interview/questions/reindex" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ indexed: 0, removed: 0 });
    }
    await app.close();
  });

  it("serves default essentials per mode, saves a custom sheet and resets it", async () => {
    const { app } = await setup();
    const initial = await app.inject({ method: "GET", url: "/api/interview/simulator/settings/case_oral" });
    expect(initial.json()).toMatchObject({ mode: "case_oral", essentialsIsDefault: true });
    expect(initial.json().essentialsSheet).toContain("CASE – ESSENTIALS");

    const custom = await app.inject({
      method: "PUT",
      url: "/api/interview/simulator/settings",
      payload: { mode: "case_oral", essentialsSheet: "Mitt ark" }
    });
    expect(custom.json()).toMatchObject({ essentialsSheet: "Mitt ark", essentialsIsDefault: false });

    const sameAsDefault = await app.inject({
      method: "PUT",
      url: "/api/interview/simulator/settings",
      payload: { mode: "case_oral", essentialsSheet: initial.json().essentialsSheet }
    });
    expect(sameAsDefault.json().essentialsIsDefault).toBe(true);

    await app.inject({
      method: "PUT",
      url: "/api/interview/simulator/settings",
      payload: { mode: "case_oral", essentialsSheet: "Mitt ark" }
    });
    const reset = await app.inject({
      method: "PUT",
      url: "/api/interview/simulator/settings",
      payload: { mode: "case_oral", essentialsSheet: null }
    });
    expect(reset.json()).toMatchObject({ essentialsIsDefault: true });
    await app.close();
  });

  it("drafts an essentials sheet from documents without saving it", async () => {
    const off = await setup({ configured: false });
    const offline = await off.app.inject({
      method: "POST",
      url: "/api/interview/simulator/settings/behavioral_mock/essentials-draft"
    });
    expect(offline.statusCode).toBe(503);
    await off.app.close();

    const { app, repo, userId, llmClient } = await setup({ structuredResults: [{ sheet: "STAR – mitt utkast" }] });
    const none = await app.inject({
      method: "POST",
      url: "/api/interview/simulator/settings/behavioral_mock/essentials-draft"
    });
    expect(none.statusCode).toBe(400);

    await repo.createKnowledgeDoc(userId, {
      kind: "star",
      title: "STAR",
      content: "Ta pausen først.",
      contentHash: sha256Content("star")
    });
    await repo.createKnowledgeDoc(userId, {
      kind: "practice",
      title: "Instruks til øvingspartner",
      content: "Spør alltid om en til.",
      contentHash: sha256Content("instruks")
    });
    const draft = await app.inject({
      method: "POST",
      url: "/api/interview/simulator/settings/behavioral_mock/essentials-draft"
    });
    expect(draft.statusCode).toBe(200);
    expect(draft.json()).toEqual({ draft: "STAR – mitt utkast", sourceDocTitles: ["STAR"] });
    expect(llmClient.structuredCalls[0]!.options.messages[1]!.content).not.toContain("Spør alltid");

    const settings = await app.inject({ method: "GET", url: "/api/interview/simulator/settings/behavioral_mock" });
    expect(settings.json().essentialsIsDefault).toBe(true);
    await app.close();
  });

  it("keeps default essentials out of the prompt and puts the plan's questions to ask in the closing round", async () => {
    const { app, repo, userId } = await setup();
    const plan = await repo.createPrepPlan(userId, {
      companyName: "DNB",
      roleTitle: "Analyst",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated(userId, plan.id, {
      questions: [
        { text: "Why DNB?", category: "motivation", target: "interview", source: "custom" },
        {
          text: "Hva overrasket deg mest?",
          category: "personal",
          audience: "ask_interviewer_personal",
          target: "interview",
          source: "bank"
        }
      ],
      tasks: []
    });
    await repo.updatePrepPlanStatus(userId, plan.id, "ready");

    const created = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", prepPlanId: plan.id }
    });
    expect(created.statusCode).toBe(201);
    const messages = await app.inject({ method: "GET", url: `/api/interview/sessions/${created.json().id}/messages` });
    const system = (messages.json() as Array<{ role: string; content: string }>).find((m) => m.role === "system")!;
    const script = system.content.split("Spørsmålsliste:")[1]!.split("\n\n")[0]!;
    expect(script).toContain("Why DNB?");
    expect(script).not.toContain("Hva overrasket deg mest?");
    expect(system.content).toContain("Til deg personlig:\n- Hva overrasket deg mest?");
    expect(system.content).not.toContain("essentials-ark");

    const onlyReverse = await repo.createPrepPlan(userId, {
      companyName: "X",
      roleTitle: "",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repo.setPrepPlanCurated(userId, onlyReverse.id, {
      questions: [
        { text: "Hva er neste steg?", category: "company", audience: "ask_interviewer_company", target: "interview" }
      ],
      tasks: []
    });
    await repo.updatePrepPlanStatus(userId, onlyReverse.id, "ready");
    const rejected = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", prepPlanId: onlyReverse.id }
    });
    expect(rejected.statusCode).toBe(400);
    await app.close();
  });
});

async function waitForUncleaned(repo: InterviewPrepMemoryRepository, userId: string, expected: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const summary = await repo.summarizeBankQuestions(userId);
    const jobs = await repo.listImportJobs(userId);
    if (summary.uncleaned === expected && jobs.every((job) => job.status !== "queued" && job.status !== "running")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Tidsavbrudd mens spørsmålene skulle ryddes.");
}
