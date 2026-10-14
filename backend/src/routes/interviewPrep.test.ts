import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { MemoryRepository } from "../memoryRepository.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { buildServer } from "../server.js";

describe("interview prep routes", () => {
  it("returns AI configuration status", async () => {
    const llmClient = new FakeLlmClient({ configured: true });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository: new InterviewPrepMemoryRepository()
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/api/interview/status" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ aiConfigured: true });

    await app.close();
  });

  it("returns empty knowledge list by default", async () => {
    const llmClient = new FakeLlmClient({ configured: false });
    const app = await buildServer({
      repository: new MemoryRepository(),
      authDisabled: true,
      llmClient,
      interviewPrepRepository: new InterviewPrepMemoryRepository()
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/api/interview/knowledge" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);

    await app.close();
  });
});
