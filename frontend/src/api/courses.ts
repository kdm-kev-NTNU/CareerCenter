import type { CoursePlan } from "@careercenter/shared";
import { request } from "./client.js";
import type { CoursePayload } from "../types/index.js";

export const coursesApi = {
  courses: () => request<CoursePlan[]>("/api/courses"),
  createCourse: (payload: CoursePayload) =>
    request<CoursePlan>("/api/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateCourse: (id: string, payload: CoursePayload) =>
    request<CoursePlan>(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCourse: (id: string) => request<void>(`/api/courses/${id}`, { method: "DELETE" })
};
