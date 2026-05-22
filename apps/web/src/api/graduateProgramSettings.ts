import type {
  GraduateProgramLocationOption,
  GraduateProgramRequirementType,
  GraduateProgramSettings,
  GraduateProgramStatusOption
} from "@careercenter/shared";
import type { CatalogLabelPayload } from "../types/index.js";
import { request } from "./client.js";

export const graduateProgramSettingsApi = {
  graduateProgramSettings() {
    return request<GraduateProgramSettings>("/api/graduate-program-settings");
  },
  createGraduateProgramStatus(payload: CatalogLabelPayload) {
    return request<GraduateProgramStatusOption>("/api/graduate-program-settings/statuses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateGraduateProgramStatus(id: string, payload: CatalogLabelPayload) {
    return request<GraduateProgramStatusOption>(`/api/graduate-program-settings/statuses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteGraduateProgramStatus(id: string) {
    return request<void>(`/api/graduate-program-settings/statuses/${id}`, { method: "DELETE" });
  },
  createGraduateProgramLocation(payload: CatalogLabelPayload) {
    return request<GraduateProgramLocationOption>("/api/graduate-program-settings/locations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateGraduateProgramLocation(id: string, payload: CatalogLabelPayload) {
    return request<GraduateProgramLocationOption>(`/api/graduate-program-settings/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteGraduateProgramLocation(id: string) {
    return request<void>(`/api/graduate-program-settings/locations/${id}`, { method: "DELETE" });
  },
  createGraduateProgramRequirementType(payload: CatalogLabelPayload) {
    return request<GraduateProgramRequirementType>("/api/graduate-program-settings/requirement-types", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateGraduateProgramRequirementType(id: string, payload: CatalogLabelPayload) {
    return request<GraduateProgramRequirementType>(`/api/graduate-program-settings/requirement-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteGraduateProgramRequirementType(id: string) {
    return request<void>(`/api/graduate-program-settings/requirement-types/${id}`, { method: "DELETE" });
  }
};
