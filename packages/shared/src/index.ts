export const careerTracks = [
  "ENERGY_QUANT",
  "AI_CONSULTING",
  "VENTURE_PE_AI_OPS",
  "INVESTMENT_TECH",
  "INDUSTRIAL_AI"
] as const;

export type CareerTrack = (typeof careerTracks)[number];

export const trackLabels: Record<CareerTrack, string> = {
  ENERGY_QUANT: "Energy, Power Trading & Quant",
  AI_CONSULTING: "Tech Consulting / AI Strategy",
  VENTURE_PE_AI_OPS: "Tech Venture, PE, Growth Equity, AI Ops",
  INVESTMENT_TECH: "Investment Technology",
  INDUSTRIAL_AI: "Industrial AI"
};

export interface CareerTrackSetting {
  id: CareerTrack;
  label: string;
  sortOrder: number;
}

export const careerTrackDefaults: CareerTrackSetting[] = careerTracks.map((track, index) => ({
  id: track,
  label: trackLabels[track],
  sortOrder: index
}));

export const courseStatuses = ["planned", "considering", "confirmed", "completed"] as const;
export type CourseStatus = (typeof courseStatuses)[number];

export interface UserProfile {
  id: string;
  email: string;
}

export interface CoursePlan {
  id: string;
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export interface Company {
  id: string;
  name: string;
  description: string;
  tracks: CareerTrack[];
  tier: 1 | 2 | 3;
  geography: string;
  roleTypes: string[];
  difficulty: "Medium" | "Medium/high" | "High" | "Very high";
  upside: "High" | "Very high";
  relevanceScore: number;
  websiteUrl?: string;
}

export interface CareerPathStep {
  id: string;
  companyId: string;
  order: number;
  note: string;
  targetRole: string;
  company?: Company;
}

export interface CareerPath {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  horizon: string;
  steps: CareerPathStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CareerMapNode {
  id: string;
  title: string;
  level: 0 | 1 | 2 | 3;
  track?: CareerTrack;
  items: string[];
}

export function assertSemester(value: number): 7 | 8 | 9 | 10 {
  if ([7, 8, 9, 10].includes(value)) {
    return value as 7 | 8 | 9 | 10;
  }
  throw new Error("Semester må være 7, 8, 9 eller 10.");
}

export function formatPath(companies: Pick<Company, "name">[]): string {
  return ["NTNU KI", ...companies.map((company) => company.name)].join(" -> ");
}
