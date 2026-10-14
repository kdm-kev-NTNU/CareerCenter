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
      payload: { companyName: "DNB", roleTitle: "Associate", format: "interview" }
    });
    const planId = planRes.json().id as string;

    const research = await app.inject({ method: "POST", url: `/api/interview/plans/${planId}/research` });
    expect(research.statusCode).toBe(202);
    const researched =
      research.json().status === "awaiting_answers"
        ? research.json()
        : await waitForPlanStatus(app, planId, "awaiting_answers");
    expect(researched.pipelineStep).toBe("awaiting_answers");

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

  it("exposes voice session mock and saves transcript messages", async () => {
    const { app } = await buildInterviewApp();
    const voice = await app.inject({ method: "POST", url: "/api/interview/voice/session" });
    expect(voice.statusCode).toBe(200);
    expect(voice.json().mock).toBe(true);
    expect(JSON.stringify(voice.json())).not.toContain("sk-");

    const session = await app.inject({
      method: "POST",
      url: "/api/interview/sessions",
      payload: { mode: "behavioral_mock", title: "Voice stub" }
    });
    const sessionId = session.json().id as string;

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

  it("manages story bank, anki export, and ability attempts", async () => {
    const { app } = await buildInterviewApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/interview/stories",
      payload: {
        title: "Ledet prosjekt",
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
        tags: ["leadership"]
      }
    });
    expect(created.statusCode).toBe(201);
    const storyId = created.json().id as string;

    const score = await app.inject({
      method: "POST",
      url: `/api/interview/stories/${storyId}/scores`,
      payload: {
        scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 2])),
        note: "Trenger strammere STAR"
      }
    });
    expect(score.statusCode).toBe(201);

    const partialScore = await app.inject({
      method: "POST",
      url: `/api/interview/stories/${storyId}/scores`,
      payload: { scores: { action: 2 }, note: "" }
    });
    expect(partialScore.statusCode).toBe(400);

    const weakest = await app.inject({ method: "GET", url: "/api/interview/stories/weakest" });
    expect(weakest.json()[0]?.id).toBe(storyId);

    const csv = await app.inject({ method: "GET", url: "/api/interview/stories/export/anki.csv" });
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body).toContain("Ledet prosjekt");

    const attempt = await app.inject({
      method: "POST",
      url: "/api/interview/ability/attempts",
      payload: { kind: "switch_challenge", seed: 42, correct: true, durationMs: 12000 }
    });
    expect(attempt.statusCode).toBe(201);
    await app.close();
  });
});
