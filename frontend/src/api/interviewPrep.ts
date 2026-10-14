import { request } from "./client.js";

export interface InterviewAiStatus {
  aiConfigured: boolean;
}

export const interviewPrepApi = {
  getStatus: () => request<InterviewAiStatus>("/api/interview/status"),
  knowledgeDocs: () => request<unknown[]>("/api/interview/knowledge")
};
