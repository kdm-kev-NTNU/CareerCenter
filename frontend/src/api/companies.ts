import type { Company } from "@careercenter/shared";
import type { CompanyPayload } from "../types/index.js";
import { request } from "./client.js";

export const companiesApi = {
  companies: (params = "") => request<Company[]>(`/api/companies${params}`),
  createCompany: (body: CompanyPayload) =>
    request<Company>("/api/companies", { method: "POST", body: JSON.stringify(body) })
};
