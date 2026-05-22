import type { CompetitionEntry } from "@careercenter/shared";
import { request } from "./client.js";
import type { CompetitionPayload } from "../types/index.js";

export const competitionsApi = {
  competitions: () => request<CompetitionEntry[]>("/api/competitions"),
  createCompetition: (payload: CompetitionPayload) =>
    request<CompetitionEntry>("/api/competitions", { method: "POST", body: JSON.stringify(payload) }),
  updateCompetition: (id: string, payload: CompetitionPayload) =>
    request<CompetitionEntry>(`/api/competitions/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCompetition: (id: string) => request<void>(`/api/competitions/${id}`, { method: "DELETE" })
};
