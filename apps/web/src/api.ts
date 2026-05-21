import type { CareerMapNode, CareerPath, Company, CoursePlan, CourseStatus, CareerTrack } from "@careercenter/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface CoursePayload {
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export interface PathPayload {
  name: string;
  description: string;
  targetRole: string;
  horizon: string;
  steps: Array<{ companyId: string; order: number; note: string; targetRole: string }>;
}

export const api = {
  careerMap: () => request<{ nodes: CareerMapNode[]; tracks: CareerTrack[] }>("/api/career-map"),
  companies: (params = "") => request<Company[]>(`/api/companies${params}`),
  courses: () => request<CoursePlan[]>("/api/courses"),
  createCourse: (payload: CoursePayload) => request<CoursePlan>("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateCourse: (id: string, payload: CoursePayload) => request<CoursePlan>(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCourse: (id: string) => request<void>(`/api/courses/${id}`, { method: "DELETE" }),
  paths: () => request<CareerPath[]>("/api/paths"),
  createPath: (payload: PathPayload) => request<CareerPath>("/api/paths", { method: "POST", body: JSON.stringify(payload) }),
  updatePath: (id: string, payload: PathPayload) => request<CareerPath>(`/api/paths/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePath: (id: string) => request<void>(`/api/paths/${id}`, { method: "DELETE" })
};
