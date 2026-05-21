import type { CareerMapNode, CareerPath, Company, CoursePlan, CourseStatus, CareerTrack, UserProfile } from "@careercenter/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface Session {
  token: string;
  user: UserProfile;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  register: (email: string, password: string) => request<Session>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) => request<Session>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  careerMap: () => request<{ nodes: CareerMapNode[]; tracks: CareerTrack[] }>("/api/career-map"),
  companies: (params = "") => request<Company[]>(`/api/companies${params}`),
  courses: (token: string) => request<CoursePlan[]>("/api/courses", {}, token),
  createCourse: (token: string, payload: CoursePayload) => request<CoursePlan>("/api/courses", { method: "POST", body: JSON.stringify(payload) }, token),
  updateCourse: (token: string, id: string, payload: CoursePayload) => request<CoursePlan>(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token),
  deleteCourse: (token: string, id: string) => request<void>(`/api/courses/${id}`, { method: "DELETE" }, token),
  paths: (token: string) => request<CareerPath[]>("/api/paths", {}, token),
  createPath: (token: string, payload: PathPayload) => request<CareerPath>("/api/paths", { method: "POST", body: JSON.stringify(payload) }, token),
  updatePath: (token: string, id: string, payload: PathPayload) => request<CareerPath>(`/api/paths/${id}`, { method: "PUT", body: JSON.stringify(payload) }, token),
  deletePath: (token: string, id: string) => request<void>(`/api/paths/${id}`, { method: "DELETE" }, token)
};

