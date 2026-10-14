import type { FastifyInstance } from "fastify";
import type { LlmClient } from "../ai/llmClient.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

export interface InterviewPrepRouteDeps {
  llmClient: LlmClient;
  interviewPrepRepository: InterviewPrepRepository;
}

export async function interviewPrepRoutes(app: FastifyInstance, deps: InterviewPrepRouteDeps) {
  app.get("/api/interview/status", async () => ({
    aiConfigured: deps.llmClient.isConfigured()
  }));

  app.get("/api/interview/knowledge", async (request) =>
    deps.interviewPrepRepository.listKnowledgeDocs(request.user.id)
  );
}
