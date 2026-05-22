import type { CareerPath } from "@careercenter/shared";
import { request } from "./client.js";
import type { PathPayload } from "../types/index.js";

export const pathsApi = {
  paths: () => request<CareerPath[]>("/api/paths"),
  createPath: (payload: PathPayload) =>
    request<CareerPath>("/api/paths", { method: "POST", body: JSON.stringify(payload) }),
  updatePath: (id: string, payload: PathPayload) =>
    request<CareerPath>(`/api/paths/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePath: (id: string) => request<void>(`/api/paths/${id}`, { method: "DELETE" })
};
