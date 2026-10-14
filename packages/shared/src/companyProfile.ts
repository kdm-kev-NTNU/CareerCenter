export interface CompanyProfile {
  industries: string[];
  businessAreas: string[];
  interviewFormats: string[];
  caseTypes: string[];
  values: string[];
  themes: string[];
  summary: string;
}

export const emptyCompanyProfile = (): CompanyProfile => ({
  industries: [],
  businessAreas: [],
  interviewFormats: [],
  caseTypes: [],
  values: [],
  themes: [],
  summary: ""
});
