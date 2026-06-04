import type {
  AiResource,
  AiResourceExportBundle,
  AiResourceExportTarget,
  AiResourceImportResult,
  AiResourceScanResult,
  AiResourceSyncResult,
  BachelorFile,
  BachelorFolder,
  BachelorFolderTreeNode,
  BachelorKnowledge,
  EducationBook,
  LearningPlatform,
  SelfStudyCourse
} from "@careercenter/shared";
import { request, uploadRequest } from "./client.js";
import type {
  AiResourceImportPayload,
  AiResourcePayload,
  BachelorFileUpdatePayload,
  BachelorFolderPayload,
  BachelorKnowledgePayload,
  EducationBookPayload,
  LearningPlatformPayload,
  SelfStudyCoursePayload
} from "../types/index.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const educationApi = {
  selfStudyCourses: () => request<SelfStudyCourse[]>("/api/education/courses"),
  createSelfStudyCourse: (payload: SelfStudyCoursePayload) =>
    request<SelfStudyCourse>("/api/education/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateSelfStudyCourse: (id: string, payload: SelfStudyCoursePayload) =>
    request<SelfStudyCourse>(`/api/education/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSelfStudyCourse: (id: string) => request<void>(`/api/education/courses/${id}`, { method: "DELETE" }),

  educationBooks: () => request<EducationBook[]>("/api/education/books"),
  createEducationBook: (payload: EducationBookPayload) =>
    request<EducationBook>("/api/education/books", { method: "POST", body: JSON.stringify(payload) }),
  updateEducationBook: (id: string, payload: EducationBookPayload) =>
    request<EducationBook>(`/api/education/books/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEducationBook: (id: string) => request<void>(`/api/education/books/${id}`, { method: "DELETE" }),

  learningPlatforms: () => request<LearningPlatform[]>("/api/education/platforms"),
  createLearningPlatform: (payload: LearningPlatformPayload) =>
    request<LearningPlatform>("/api/education/platforms", { method: "POST", body: JSON.stringify(payload) }),
  updateLearningPlatform: (id: string, payload: LearningPlatformPayload) =>
    request<LearningPlatform>(`/api/education/platforms/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLearningPlatform: (id: string) => request<void>(`/api/education/platforms/${id}`, { method: "DELETE" }),

  aiResources: (query = "") => request<AiResource[]>(`/api/education/ai-resources${query}`),
  createAiResource: (payload: AiResourcePayload) =>
    request<AiResource>("/api/education/ai-resources", { method: "POST", body: JSON.stringify(payload) }),
  updateAiResource: (id: string, payload: AiResourcePayload) =>
    request<AiResource>(`/api/education/ai-resources/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAiResource: (id: string) => request<void>(`/api/education/ai-resources/${id}`, { method: "DELETE" }),
  importAiResources: (payload: AiResourceImportPayload) =>
    request<AiResourceImportResult>("/api/education/ai-resources/import", { method: "POST", body: JSON.stringify(payload) }),
  exportAiResources: (target: AiResourceExportTarget = "all") =>
    request<AiResourceExportBundle>(`/api/education/ai-resources/export?target=${encodeURIComponent(target)}`),
  syncAiResources: (payload: { target: AiResourceExportTarget; cwd: string; force?: boolean }) =>
    request<AiResourceSyncResult>("/api/education/ai-resources/sync", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  scanAiResources: (payload: { cwd: string }) =>
    request<AiResourceScanResult>("/api/education/ai-resources/scan", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  bachelorKnowledge: (folderId?: string | null) => {
    if (folderId === undefined) return request<BachelorKnowledge[]>("/api/education/bachelor");
    const query = folderId === null ? "folderId=" : `folderId=${encodeURIComponent(folderId)}`;
    return request<BachelorKnowledge[]>(`/api/education/bachelor?${query}`);
  },
  createBachelorKnowledge: (payload: BachelorKnowledgePayload) =>
    request<BachelorKnowledge>("/api/education/bachelor", { method: "POST", body: JSON.stringify(payload) }),
  updateBachelorKnowledge: (id: string, payload: BachelorKnowledgePayload) =>
    request<BachelorKnowledge>(`/api/education/bachelor/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBachelorKnowledge: (id: string) => request<void>(`/api/education/bachelor/${id}`, { method: "DELETE" }),

  bachelorFolderTree: () =>
    request<BachelorFolderTreeNode[]>("/api/education/bachelor/folders?tree=true"),
  createBachelorFolder: (payload: BachelorFolderPayload) =>
    request<BachelorFolder>("/api/education/bachelor/folders", { method: "POST", body: JSON.stringify(payload) }),
  updateBachelorFolder: (id: string, payload: BachelorFolderPayload) =>
    request<BachelorFolder>(`/api/education/bachelor/folders/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBachelorFolder: (id: string) => request<void>(`/api/education/bachelor/folders/${id}`, { method: "DELETE" }),

  bachelorFiles: (folderId: string | null) => {
    const query = folderId === null ? "folderId=" : `folderId=${encodeURIComponent(folderId)}`;
    return request<BachelorFile[]>(`/api/education/bachelor/files?${query}`);
  },
  uploadBachelorFile: (file: File, folderId: string | null, notes = "") => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderId) formData.append("folderId", folderId);
    if (notes) formData.append("notes", notes);
    return uploadRequest<BachelorFile>("/api/education/bachelor/files", formData);
  },
  updateBachelorFile: (id: string, payload: BachelorFileUpdatePayload) =>
    request<BachelorFile>(`/api/education/bachelor/files/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBachelorFile: (id: string) => request<void>(`/api/education/bachelor/files/${id}`, { method: "DELETE" }),
  bachelorFileDownloadUrl: (id: string) => `${API_BASE}/api/education/bachelor/files/${id}/download`
};
