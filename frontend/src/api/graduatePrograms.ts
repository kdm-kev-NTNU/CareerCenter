import type { CareerTrack, GraduateProgram } from "@careercenter/shared";
import type { GraduateProgramPayload } from "../types/index.js";
import { request } from "./client.js";

export interface GraduateProgramQuery {
  q?: string;
  statusId?: string;
  locationId?: string;
  track?: CareerTrack;
}

export const graduateProgramsApi = {
  graduatePrograms(query: GraduateProgramQuery = {}) {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.statusId) params.set("statusId", query.statusId);
    if (query.locationId) params.set("locationId", query.locationId);
    if (query.track) params.set("track", query.track);
    const suffix = params.toString() ? `?${params}` : "";
    return request<GraduateProgram[]>(`/api/graduate-programs${suffix}`);
  },
  createGraduateProgram(payload: GraduateProgramPayload) {
    return request<GraduateProgram>("/api/graduate-programs", { method: "POST", body: JSON.stringify(payload) });
  },
  updateGraduateProgram(id: string, payload: GraduateProgramPayload) {
    return request<GraduateProgram>(`/api/graduate-programs/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteGraduateProgram(id: string) {
    return request<void>(`/api/graduate-programs/${id}`, { method: "DELETE" });
  }
};
