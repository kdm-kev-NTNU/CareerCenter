import { starRubricCriteria } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { MemoryRepository } from "../memoryRepository.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { buildServer } from "../server.js";

describe("interview prep routes", () => {
  async function buildInterviewApp(structuredResult?: unknown) {
    const llmClient = new FakeLlmClient({
      configured: true,
      structuredResult: structuredResult ?? {
        clarifications: [{ question: "Hvilken rolle?" }],
        questions: [{ text: "Hvorfor dette selskapet?", category: "motivation", target: "interview" }],
        tasks: [{ title: "Les careers page", description: "" }]
      }
    });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository: new InterviewPrepMemoryRepository()
    });
    await app.ready();
    return app;
  }

  it("returns AI configuration status", async () => {
    const app = await buildInterviewApp();
    const response = await app.inject({ method: "GET", url: "/api/interview/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ aiConfigured: true });
    await app.close();
  });

  it("creates knowledge and hides case secrets in list", async () => {
    const app = await buildInterviewApp();
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
    const app = await buildInterviewApp();
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
    const app = await buildInterviewApp({
      clarifications: [{ question: "Hvilken rolle?" }],
      questions: [{ text: "Hvorfor DNB?", category: "motivation", target: "interview" }],
      tasks: [{ title: "Les årsrapport", description: "" }],
      scores: Object.fromEntries(starRubricCriteria.map((key) => [key, 4])),
      sum: 32,
      improvement: "Fortsett slik."
    });

    const planRes = await app.inject({
      method: "POST",
      url: "/api/interview/plans",
      payload: { companyName: "DNB", roleTitle: "Associate", format: "interview" }
    });
    const planId = planRes.json().id as string;

    const research = await app.inject({ method: "POST", url: `/api/interview/plans/${planId}/research` });
    expect(research.statusCode).toBe(200);
    expect(research.json().status).toBe("awaiting_answers");

    const clarifications = research.json().clarifications as Array<{ id: string }>;
    const curated = await app.inject({
      method: "POST",
      url: `/api/interview/plans/${planId}/clarifications`,
      payload: { answers: [{ id: clarifications[0]!.id, answer: "Tech" }] }
    });
    expect(curated.json().status).toBe("ready");

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
});
