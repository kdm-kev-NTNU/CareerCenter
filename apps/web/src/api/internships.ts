import type { CareerTrack, Internship } from "@careercenter/shared";
import type { InternshipPayload } from "../types/index.js";
import { request } from "./client.js";

export interface InternshipQuery {
  q?: string;
  statusId?: string;
  locationId?: string;
  track?: CareerTrack;
}

export const internshipsApi = {
  internships(query: InternshipQuery = {}) {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.statusId) params.set("statusId", query.statusId);
    if (query.locationId) params.set("locationId", query.locationId);
    if (query.track) params.set("track", query.track);
    const suffix = params.toString() ? `?${params}` : "";
    return request<Internship[]>(`/api/internships${suffix}`);
  },
  createInternship(payload: InternshipPayload) {
    return request<Internship>("/api/internships", { method: "POST", body: JSON.stringify(payload) });
  },
  updateInternship(id: string, payload: InternshipPayload) {
    return request<Internship>(`/api/internships/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },
  deleteInternship(id: string) {
    return request<void>(`/api/internships/${id}`, { method: "DELETE" });
  }
};
