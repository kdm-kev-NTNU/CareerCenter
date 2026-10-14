import type {
  InterviewAbilityTestAttemptDto,
  InterviewBankQuestionDto,
  InterviewCaseEntryDto,
  InterviewCasePublicDto,
  InterviewCaseRepertoireLogDto,
  InterviewImportJobDto,
  InterviewKnowledgeDocDto,
  InterviewMessageDto,
  InterviewPrepPlanCaseDto,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  InterviewStoryBankEntryDto,
  InterviewStoryScoreDto,
  InterviewVideoRunDto,
  InterviewVideoSettingsDto,
  InterviewMode,
  PrepFormat,
  VideoSimulatorSettings,
  VoiceSessionDto,
  AnswerStats,
  InterviewSessionFeedbackDto
} from "@careercenter/shared";
import { request, uploadRequest } from "./client.js";

export interface InterviewAiStatus {
  aiConfigured: boolean;
}

export interface KnowledgeImportResult {
  doc: InterviewKnowledgeDocDto;
  caseEntry: InterviewCasePublicDto | null;
  importJob: InterviewImportJobDto | null;
  deduplicated: boolean;
}

export interface PrepPlanDetail {
  plan: InterviewPrepPlanDto;
  rankedCases: InterviewPrepPlanCaseDto[];
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

  searchQuestions: (params: { q?: string; category?: string; tag?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.category) query.set("category", params.category);
    if (params.tag) query.set("tag", params.tag);
    const suffix = query.toString() ? `?${query}` : "";
    return request<InterviewBankQuestionDto[]>(`/api/interview/questions${suffix}`);
  },
  reindexQuestions: () =>
    request<{ indexed: number }>("/api/interview/questions/reindex", { method: "POST" }),

  cases: (params: { q?: string; sourceKind?: string; style?: string; approvalStatus?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.sourceKind) query.set("sourceKind", params.sourceKind);
    if (params.style) query.set("style", params.style);
    if (params.approvalStatus) query.set("approvalStatus", params.approvalStatus);
    const suffix = query.toString() ? `?${query}` : "";
    return request<InterviewCasePublicDto[]>(`/api/interview/cases${suffix}`);
  },
  case: (id: string) => request<InterviewCaseEntryDto>(`/api/interview/cases/${id}`),
  createCase: (payload: Omit<InterviewCaseEntryDto, "id" | "createdAt" | "updatedAt">) =>
    request<{ case: InterviewCaseEntryDto; deduplicated: boolean }>("/api/interview/cases", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  deleteCase: (id: string) => request<void>(`/api/interview/cases/${id}`, { method: "DELETE" }),
  approveCase: (id: string) =>
    request<InterviewCasePublicDto>(`/api/interview/cases/${id}/approve`, { method: "POST" }),
  rejectCase: (id: string) =>
    request<InterviewCasePublicDto>(`/api/interview/cases/${id}/reject`, { method: "POST" }),

  importJobs: () => request<InterviewImportJobDto[]>("/api/interview/import-jobs"),
  importJob: (id: string) => request<InterviewImportJobDto>(`/api/interview/import-jobs/${id}`),
  retryImportJob: (id: string) =>
    request<InterviewImportJobDto>(`/api/interview/import-jobs/${id}/retry`, { method: "POST" }),

  plans: () => request<InterviewPrepPlanDto[]>("/api/interview/plans"),
  plan: (id: string) => request<PrepPlanDetail>(`/api/interview/plans/${id}`),
  createPlan: (payload: { companyName: string; roleTitle?: string; format?: PrepFormat }) =>
    request<InterviewPrepPlanDto>("/api/interview/plans", { method: "POST", body: JSON.stringify(payload) }),
  startPlanResearch: (id: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/research`, { method: "POST" }),
  submitClarifications: (
    id: string,
    answers: Array<{ id: string; answer: string }>,
    skip = false
  ) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/clarifications`, {
      method: "POST",
      body: JSON.stringify({ answers, skip })
    }),
  replacePlanQuestion: (
    planId: string,
    questionId: string,
    payload: { bankQuestionId?: string; text?: string; category?: string; target?: string; storyId?: string | null }
  ) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${planId}/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
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
  createSession: (payload: { mode: InterviewMode; title?: string; prepPlanId?: string; caseEntryId?: string }) =>
    request<InterviewSessionDto>("/api/interview/sessions", { method: "POST", body: JSON.stringify(payload) }),
  sessionMessages: (sessionId: string) =>
    request<InterviewMessageDto[]>(`/api/interview/sessions/${sessionId}/messages`),
  sendSessionMessage: (sessionId: string, content: string) =>
    request<InterviewMessageDto>(`/api/interview/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),
  finishSession: (sessionId: string) =>
    request<InterviewSessionDto>(`/api/interview/sessions/${sessionId}/finish`, { method: "POST" }),

  createVoiceSession: () => request<VoiceSessionDto>("/api/interview/voice/session", { method: "POST" }),
  appendTranscript: (sessionId: string, payload: { role: "user" | "assistant"; content: string }) =>
    request<InterviewMessageDto>(`/api/interview/sessions/${sessionId}/transcript`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  videoSettings: () => request<InterviewVideoSettingsDto>("/api/interview/video/settings"),
  saveVideoSettings: (payload: VideoSimulatorSettings) =>
    request<InterviewVideoSettingsDto>("/api/interview/video/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  videoRuns: () => request<InterviewVideoRunDto[]>("/api/interview/video/runs"),
  createVideoRun: (payload: {
    state: string;
    cardIndex?: number;
    blobKey?: string;
    transcript?: string;
    settings: VideoSimulatorSettings;
  }) =>
    request<InterviewVideoRunDto>("/api/interview/video/runs", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  transcribeVideo: (payload: {
    blobKey?: string;
    note?: string;
    audioBase64?: string;
    filename?: string;
    mimeType?: string;
    durationMs?: number;
    withRubric?: boolean;
  }) =>
    request<{
      mock: boolean;
      transcript: string;
      blobKey?: string;
      stats?: AnswerStats;
      feedback?: InterviewSessionFeedbackDto | null;
    }>("/api/interview/video/transcribe", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  abilityAttempts: () => request<InterviewAbilityTestAttemptDto[]>("/api/interview/ability/attempts"),
  createAbilityAttempt: (payload: {
    kind: string;
    seed: number;
    correct: boolean;
    durationMs: number;
  }) =>
    request<InterviewAbilityTestAttemptDto>("/api/interview/ability/attempts", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  stories: () => request<InterviewStoryBankEntryDto[]>("/api/interview/stories"),
  weakestStories: () => request<InterviewStoryBankEntryDto[]>("/api/interview/stories/weakest"),
  createStory: (payload: Omit<InterviewStoryBankEntryDto, "id" | "createdAt" | "updatedAt" | "latestSum" | "averageSum">) =>
    request<InterviewStoryBankEntryDto>("/api/interview/stories", { method: "POST", body: JSON.stringify(payload) }),
  updateStory: (id: string, payload: Omit<InterviewStoryBankEntryDto, "id" | "createdAt" | "updatedAt" | "latestSum" | "averageSum">) =>
    request<InterviewStoryBankEntryDto>(`/api/interview/stories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  deleteStory: (id: string) => request<void>(`/api/interview/stories/${id}`, { method: "DELETE" }),
  storyScores: (id: string) => request<InterviewStoryScoreDto[]>(`/api/interview/stories/${id}/scores`),
  addStoryScore: (id: string, payload: { scores: Record<string, number>; note?: string }) =>
    request<InterviewStoryScoreDto>(`/api/interview/stories/${id}/scores`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  ankiExportUrl: () => "/api/interview/stories/export/anki.csv",

  repertoireLogs: () => request<InterviewCaseRepertoireLogDto[]>("/api/interview/repertoire"),
  createRepertoireLog: (payload: {
    caseEntryId?: string;
    title: string;
    company?: string;
    format?: string;
    tested?: string;
    improvement: string;
    outcome?: string;
    notes?: string;
    practicedAt?: string;
  }) =>
    request<InterviewCaseRepertoireLogDto>("/api/interview/repertoire", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
