import type {
  InterviewCaseEntryDto,
  InterviewCasePublicDto,
  InterviewKnowledgeDocDto,
  InterviewMessageDto,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  InterviewMode,
  PrepFormat,
  RankableCase
} from "@careercenter/shared";
import { request, uploadRequest } from "./client.js";

export interface InterviewAiStatus {
  aiConfigured: boolean;
}

export interface KnowledgeImportResult {
  doc: InterviewKnowledgeDocDto;
  caseEntry: InterviewCasePublicDto | null;
  deduplicated: boolean;
}

export interface PrepPlanDetail {
  plan: InterviewPrepPlanDto;
  rankedCases: RankableCase[];
}

export const interviewPrepApi = {
  getStatus: () => request<InterviewAiStatus>("/api/interview/status"),

  knowledgeDocs: () => request<InterviewKnowledgeDocDto[]>("/api/interview/knowledge"),
  createKnowledge: (payload: { title: string; content: string; kind?: string }) =>
    request<{ doc: InterviewKnowledgeDocDto; deduplicated: boolean }>("/api/interview/knowledge", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateKnowledge: (id: string, payload: { title: string; content: string; kind?: string }) =>
    request<InterviewKnowledgeDocDto>(`/api/interview/knowledge/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteKnowledge: (id: string) => request<void>(`/api/interview/knowledge/${id}`, { method: "DELETE" }),
  importKnowledge: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest<KnowledgeImportResult>("/api/interview/knowledge/import", formData);
  },

  cases: () => request<InterviewCasePublicDto[]>("/api/interview/cases"),
  case: (id: string) => request<InterviewCaseEntryDto>(`/api/interview/cases/${id}`),
  createCase: (payload: Omit<InterviewCaseEntryDto, "id" | "createdAt" | "updatedAt">) =>
    request<{ case: InterviewCaseEntryDto; deduplicated: boolean }>("/api/interview/cases", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  deleteCase: (id: string) => request<void>(`/api/interview/cases/${id}`, { method: "DELETE" }),

  plans: () => request<InterviewPrepPlanDto[]>("/api/interview/plans"),
  plan: (id: string) => request<PrepPlanDetail>(`/api/interview/plans/${id}`),
  createPlan: (payload: { companyName: string; roleTitle?: string; format?: PrepFormat }) =>
    request<InterviewPrepPlanDto>("/api/interview/plans", { method: "POST", body: JSON.stringify(payload) }),
  startPlanResearch: (id: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/research`, { method: "POST" }),
  submitClarifications: (id: string, answers: Array<{ id: string; answer: string }>) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/clarifications`, {
      method: "POST",
      body: JSON.stringify({ answers })
    }),

  simulatorSettings: (mode: InterviewMode) =>
    request<InterviewSimulatorSettingsDto>(`/api/interview/simulator/settings/${mode}`),
  saveSimulatorSettings: (payload: InterviewSimulatorSettingsDto) =>
    request<InterviewSimulatorSettingsDto>("/api/interview/simulator/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  sessions: (mode?: InterviewMode) =>
    request<InterviewSessionDto[]>(mode ? `/api/interview/sessions?mode=${mode}` : "/api/interview/sessions"),
  createSession: (payload: { mode: InterviewMode; title?: string; prepPlanId?: string }) =>
    request<InterviewSessionDto>("/api/interview/sessions", { method: "POST", body: JSON.stringify(payload) }),
  sessionMessages: (sessionId: string) =>
    request<InterviewMessageDto[]>(`/api/interview/sessions/${sessionId}/messages`),
  sendSessionMessage: (sessionId: string, content: string) =>
    request<InterviewMessageDto>(`/api/interview/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  finishSession: (sessionId: string) =>
    request<InterviewSessionDto>(`/api/interview/sessions/${sessionId}/finish`, { method: "POST" })
};
