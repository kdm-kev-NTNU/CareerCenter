import type { ThesisCompany } from "@careercenter/shared";
import { request } from "./client.js";
import type { ThesisCompanyPayload } from "../types/index.js";

export const thesisCompaniesApi = {
  thesisCompanies: () => request<ThesisCompany[]>("/api/thesis-companies"),
  createThesisCompany: (payload: ThesisCompanyPayload) =>
    request<ThesisCompany>("/api/thesis-companies", { method: "POST", body: JSON.stringify(payload) }),
  updateThesisCompany: (id: string, payload: ThesisCompanyPayload) =>
    request<ThesisCompany>(`/api/thesis-companies/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteThesisCompany: (id: string) => request<void>(`/api/thesis-companies/${id}`, { method: "DELETE" })
};
