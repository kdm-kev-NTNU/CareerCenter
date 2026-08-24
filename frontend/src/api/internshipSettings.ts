import type {
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipSettings,
  InternshipStatusOption
} from "@careercenter/shared";
import type { CatalogLabelPayload } from "../types/index.js";
import { request } from "./client.js";

export const internshipSettingsApi = {
  settings() {
    return request<InternshipSettings>("/api/internship-settings");
  },
  createStatus(payload: CatalogLabelPayload) {
    return request<InternshipStatusOption>("/api/internship-settings/statuses", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateStatus(id: string, payload: CatalogLabelPayload) {
    return request<InternshipStatusOption>(`/api/internship-settings/statuses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteStatus(id: string) {
    return request<void>(`/api/internship-settings/statuses/${id}`, { method: "DELETE" });
  },
  reorderStatuses(ids: string[]) {
    return request<InternshipStatusOption[]>("/api/internship-settings/statuses/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids })
    });
  },
  createLocation(payload: CatalogLabelPayload) {
    return request<InternshipLocationOption>("/api/internship-settings/locations", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateLocation(id: string, payload: CatalogLabelPayload) {
    return request<InternshipLocationOption>(`/api/internship-settings/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteLocation(id: string) {
    return request<void>(`/api/internship-settings/locations/${id}`, { method: "DELETE" });
  },
  createRequirementType(payload: CatalogLabelPayload) {
    return request<InternshipRequirementType>("/api/internship-settings/requirement-types", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateRequirementType(id: string, payload: CatalogLabelPayload) {
    return request<InternshipRequirementType>(`/api/internship-settings/requirement-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteRequirementType(id: string) {
    return request<void>(`/api/internship-settings/requirement-types/${id}`, { method: "DELETE" });
  }
};
