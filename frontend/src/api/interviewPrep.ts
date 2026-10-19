import type {
  AonSourcePdfMeta,
  CandidateBackgroundDto,
  EssentialsDraftDto,
  InterviewAbilityTestAttemptDto,
  InterviewBankQuestionDto,
  InterviewBankQuestionSummaryDto,
  InterviewCaseEntryDto,
  InterviewCasePublicDto,
  InterviewImportJobDto,
  InterviewKnowledgeDocDto,
  InterviewMessageDto,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  InterviewSimulatorSettingsInput,
  InterviewVideoRunDto,
  InterviewVideoSettingsDto,
  InterviewMode,
  PlanSectionKey,
  PrepFormat,
  QuestionAudience,
  QuestionCategory,
  QuestionDiscardReason,
  ResearchModel,
  VideoSimulatorSettings,
  VideoQuestionRequest,
  VideoQuestionsDto,
  VideoRateResultDto,
  VideoTranscribeResultDto,
  VoiceSessionDto,
  InterviewSessionFeedbackDto
} from "@careercenter/shared";
import { LLM_REQUEST_TIMEOUT_MS, request, requestBlob, uploadRequest } from "./client.js";

export type AonSourcePdfListItem = AonSourcePdfMeta & { available: boolean };

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

  searchQuestions: (
    params: {
      q?: string;
      category?: string;
      tag?: string;
      audience?: QuestionAudience;
      status?: "active" | "discarded" | "all";
    } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.category) query.set("category", params.category);
    if (params.tag) query.set("tag", params.tag);
    if (params.audience) query.set("audience", params.audience);
    if (params.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query}` : "";
    return request<InterviewBankQuestionDto[]>(`/api/interview/questions${suffix}`);
  },
  questionSummary: () => request<InterviewBankQuestionSummaryDto>("/api/interview/questions/summary"),
  updateQuestion: (
    id: string,
    payload: { text?: string; category?: QuestionCategory; audience?: QuestionAudience }
  ) =>
    request<InterviewBankQuestionDto>(`/api/interview/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  discardQuestion: (id: string, reason?: QuestionDiscardReason) =>
    request<InterviewBankQuestionDto>(`/api/interview/questions/${id}/discard`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {})
    }),
  restoreQuestion: (id: string) =>
    request<InterviewBankQuestionDto>(`/api/interview/questions/${id}/restore`, { method: "POST" }),
  cleanupQuestions: (reset = false) =>
    request<{ queuedJobs: InterviewImportJobDto[]; uncleaned: number; message: string }>(
      "/api/interview/questions/cleanup",
      { method: "POST", body: JSON.stringify({ reset }) }
    ),
  reindexQuestions: () =>
    request<{
      indexed: number;
      removed: number;
      queuedJobs: number;
      cleanupJobs: number;
      documentCount: number;
      message: string;
    }>("/api/interview/questions/reindex", { method: "POST" }),

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
  cancelImportJob: (id: string) =>
    request<InterviewImportJobDto>(`/api/interview/import-jobs/${id}/cancel`, { method: "POST" }),
  deleteImportJob: (id: string) => request<void>(`/api/interview/import-jobs/${id}`, { method: "DELETE" }),

  background: () => request<CandidateBackgroundDto>("/api/interview/background"),
  saveBackgroundNotes: (notes: string) =>
    request<CandidateBackgroundDto>("/api/interview/background", {
      method: "PUT",
      body: JSON.stringify({ notes })
    }),
  uploadBackgroundCv: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest<CandidateBackgroundDto>("/api/interview/background/cv", formData);
  },
  uploadBackgroundTranscript: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return uploadRequest<CandidateBackgroundDto>("/api/interview/background/transcript", formData);
  },

  plans: () => request<InterviewPrepPlanDto[]>("/api/interview/plans"),
  plan: (id: string) => request<PrepPlanDetail>(`/api/interview/plans/${id}`),
  createPlan: (payload: {
    companyName: string;
    roleTitle?: string;
    format?: PrepFormat;
    researchModel?: ResearchModel;
    jobAdText?: string;
  }) =>
    request<InterviewPrepPlanDto>("/api/interview/plans", { method: "POST", body: JSON.stringify(payload) }),
  startPlanResearch: (id: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/research`, { method: "POST" }),
  resumePlan: (id: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/resume`, { method: "POST" }),
  cancelPlan: (id: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${id}/cancel`, { method: "POST" }),
  deletePlan: (id: string) => request<void>(`/api/interview/plans/${id}`, { method: "DELETE" }),
  downloadPracticeDocx: async (planId: string, companyName: string) => {
    const blob = await requestBlob(`/api/interview/plans/${planId}/practice.docx`);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName = companyName
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60);
    anchor.href = url;
    anchor.download = `${safeName || "bedrift"}-øvingsdokument.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
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
  patchPlanQuestion: (
    planId: string,
    questionId: string,
    payload: { text?: string; category?: string; notes?: string; included?: boolean }
  ) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${planId}/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  addPlanQuestion: (
    planId: string,
    payload: {
      text: string;
      category: string;
      target?: string;
      notes?: string;
      included?: boolean;
    }
  ) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${planId}/questions`, {
      method: "POST",
      body: JSON.stringify({ ...payload, audience: "candidate" })
    }),
  deletePlanQuestion: (planId: string, questionId: string) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${planId}/questions/${questionId}`, {
      method: "DELETE"
    }),
  reorderPlanQuestions: (planId: string, orderedIds: string[]) =>
    request<InterviewPrepPlanDto>(`/api/interview/plans/${planId}/questions/order`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds })
    }),

  simulatorSettings: (mode: InterviewMode) =>
    request<InterviewSimulatorSettingsDto>(`/api/interview/simulator/settings/${mode}`),
  saveSimulatorSettings: (payload: InterviewSimulatorSettingsInput) =>
    request<InterviewSimulatorSettingsDto>("/api/interview/simulator/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  essentialsDraft: (mode: InterviewMode) =>
    request<EssentialsDraftDto>(`/api/interview/simulator/settings/${mode}/essentials-draft`, { method: "POST" }),

  sessions: (filter: { mode?: InterviewMode; prepPlanId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filter.mode) params.set("mode", filter.mode);
    if (filter.prepPlanId) params.set("prepPlanId", filter.prepPlanId);
    const query = params.toString();
    return request<InterviewSessionDto[]>(`/api/interview/sessions${query ? `?${query}` : ""}`);
  },
  createSession: (payload: {
    mode: InterviewMode;
    title?: string;
    prepPlanId?: string;
    planSection?: PlanSectionKey;
    caseEntryId?: string;
  }) =>
    request<InterviewSessionDto>("/api/interview/sessions", { method: "POST", body: JSON.stringify(payload) }),
  deleteSession: (sessionId: string) => request<void>(`/api/interview/sessions/${sessionId}`, { method: "DELETE" }),
  sessionMessages: (sessionId: string) =>
    request<InterviewMessageDto[]>(`/api/interview/sessions/${sessionId}/messages`),
  finishSession: (sessionId: string) =>
    request<InterviewSessionDto>(`/api/interview/sessions/${sessionId}/finish`, {
      method: "POST",
      signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
    }),

  createVoiceSession: (sessionId: string) =>
    request<VoiceSessionDto>("/api/interview/voice/session", {
      method: "POST",
      body: JSON.stringify({ sessionId })
    }),
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
  generateVideoQuestions: (payload: VideoQuestionRequest) =>
    request<VideoQuestionsDto>("/api/interview/video/questions", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  videoRuns: () => request<InterviewVideoRunDto[]>("/api/interview/video/runs"),
  createVideoRun: (payload: {
    state: string;
    cardIndex?: number;
    blobKey?: string;
    transcript?: string;
    prompt?: string;
    companyName?: string;
    roleDescription?: string;
    feedback?: InterviewSessionFeedbackDto;
    settings: VideoSimulatorSettings;
  }) =>
    request<InterviewVideoRunDto>("/api/interview/video/runs", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  transcribeVideo: (payload: {
    file?: Blob;
    filename?: string;
    note?: string;
    mimeType?: string;
    durationMs?: number;
    prompt?: string;
    withRubric?: boolean;
    model?: string;
  }) => {
    const formData = new FormData();
    if (payload.file) {
      formData.append(
        "file",
        payload.file,
        payload.filename ?? "answer.webm"
      );
    }
    if (payload.note) formData.append("note", payload.note);
    if (payload.mimeType) formData.append("mimeType", payload.mimeType);
    if (payload.durationMs !== undefined) formData.append("durationMs", String(payload.durationMs));
    if (payload.prompt) formData.append("prompt", payload.prompt);
    if (payload.model) formData.append("model", payload.model);
    formData.append("withRubric", payload.withRubric ? "true" : "false");
    return uploadRequest<VideoTranscribeResultDto>("/api/interview/video/transcribe", formData);
  },
  rateVideo: (payload: { prompt: string; transcript: string; durationMs?: number; model?: string }) =>
    request<VideoRateResultDto>("/api/interview/video/rate", {
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

  aonSourcePdfs: () =>
    request<AonSourcePdfListItem[]>("/api/interview/ability/aon/sources"),
  openAonSourcePdf: async (id: string, filename: string) => {
    const blob = await requestBlob(`/api/interview/ability/aon/sources/${id}`);
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    }
    // Revoke after the browser has had time to load the blob URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
};
