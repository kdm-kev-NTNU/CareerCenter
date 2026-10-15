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
    await repo.replaceBankQuestionsForDoc(
      userId,
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: `Seeded question ${i}?`,
        category: "behavioral" as const,
        tags: ["seed"],
        contentHash: sha256Content(`seed-q-${doc.id}-${i}`)
      }))
    );
    return repo.listBankQuestions(userId);
  }

  async function buildInterviewApp(options: {
    structuredResult?: unknown;
    structuredResults?: unknown[];
    repo?: InterviewPrepMemoryRepository;
  } = {}) {
    const interviewPrepRepository = options.repo ?? new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      configured: true,
      structuredResult: options.structuredResult ?? {
        clarifications: [{ question: "Hvilken rolle?" }],
        scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 3])),
        sum: 24,
        improvement: "ok"
      },
      structuredResults: options.structuredResults
    });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository
    });
    await app.ready();
    return { app, interviewPrepRepository };
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
