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

export const learningStatuses = ["planned", "in_progress", "completed"] as const;
export type LearningStatus = (typeof learningStatuses)[number];

export interface SelfStudyCourse {
  id: string;
  title: string;
  provider: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  completedAt?: string;
  sortOrder: number;
}

export interface EducationBook {
  id: string;
  title: string;
  author?: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  sortOrder: number;
}

export interface LearningPlatform {
  id: string;
  name: string;
  url?: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BachelorKnowledge {
  id: string;
  folderId: string | null;
  courseName: string;
  topic: string;
  notes: string;
  sortOrder: number;
}

export interface BachelorFolder {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface BachelorFolderTreeNode extends BachelorFolder {
  children: BachelorFolderTreeNode[];
}

export interface BachelorFile {
  id: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string;
  sortOrder: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
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

export interface CareerMapNode {
  id: string;
  title: string;
  level: 0 | 1 | 2 | 3;
  track?: CareerTrack;
  items: string[];
}

export type BoardNodeType = "company" | "milestone" | "note";

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardPosition {
  x: number;
  y: number;
}

export interface BoardCompanyNodeData {
  companyId: string;
  note?: string;
  track?: CareerTrack;
}

export interface BoardMilestoneNodeData {
  label: string;
  track?: CareerTrack;
}

export interface BoardNoteNodeData {
  text: string;
}

export type BoardNodeData = BoardCompanyNodeData | BoardMilestoneNodeData | BoardNoteNodeData;

export interface BoardGraphNode {
  id: string;
  type: BoardNodeType;
  position: BoardPosition;
  data: BoardNodeData;
}

export interface BoardGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface BoardGraph {
  nodes: BoardGraphNode[];
  edges: BoardGraphEdge[];
}

export interface CareerBoard {
  id: string;
  name: string;
  description: string;
  viewport: BoardViewport | null;
  graph: BoardGraph;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareerBoardSummary {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function assertSemester(value: number): 7 | 8 | 9 | 10 {
  if ([7, 8, 9, 10].includes(value)) {
    return value as 7 | 8 | 9 | 10;
  }
  throw new Error("Semester må være 7, 8, 9 eller 10.");
}

export const competitionTypes = ["hackathon", "competition", "case_competition", "datathon", "other"] as const;
export type CompetitionType = (typeof competitionTypes)[number];

export const competitionScopes = ["NORWAY", "NORDICS", "EUROPE", "GLOBAL"] as const;
export type CompetitionScope = (typeof competitionScopes)[number];

export const competitionFormats = ["online", "onsite", "hybrid"] as const;
export type CompetitionFormat = (typeof competitionFormats)[number];

export const competitionStatuses = [
  "watching",
  "considering",
  "registered",
  "participating",
  "completed",
  "won",
  "dropped"
] as const;
export type CompetitionStatus = (typeof competitionStatuses)[number];

export const competitionTypeLabels: Record<CompetitionType, string> = {
  hackathon: "Hackathon",
  competition: "Konkurranse",
  case_competition: "Case-konkurranse",
  datathon: "Datathon",
  other: "Annet"
};

export const competitionScopeLabels: Record<CompetitionScope, string> = {
  NORWAY: "Norge",
  NORDICS: "Norden",
  EUROPE: "Europa",
  GLOBAL: "Globalt"
};

export const competitionFormatLabels: Record<CompetitionFormat, string> = {
  online: "Online",
  onsite: "Fysisk",
  hybrid: "Hybrid"
};

export const competitionStatusLabels: Record<CompetitionStatus, string> = {
  watching: "Følger med",
  considering: "Vurderer",
  registered: "Påmeldt",
  participating: "Deltar",
  completed: "Fullført",
  won: "Vant / plassering",
  dropped: "Avsluttet"
};

export interface CompetitionEntry {
  id: string;
  title: string;
  type: CompetitionType;
  scope: CompetitionScope;
  format: CompetitionFormat;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  location: string;
  organizer: string;
  url?: string;
  status: CompetitionStatus;
  notes: string;
  sortOrder: number;
}

export interface InternshipStatusOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface InternshipLocationOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface InternshipRequirementType {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface InternshipRequirementItem {
  id: string;
  requirementTypeId: string;
  label?: string;
  description?: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface Internship {
  id: string;
  companyId?: string;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string;
  statusId: string;
  status?: InternshipStatusOption;
  locationIds: string[];
  locations?: InternshipLocationOption[];
  trackTags: CareerTrack[];
  requirements: InternshipRequirementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InternshipSettings {
  statuses: InternshipStatusOption[];
  locations: InternshipLocationOption[];
  requirementTypes: InternshipRequirementType[];
}

export interface GraduateProgramStatusOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface GraduateProgramLocationOption {
  id: string;
  label: string;
  sortOrder: number;
}

export interface GraduateProgramRequirementType {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface GraduateProgramRequirementItem {
  id: string;
  requirementTypeId: string;
  label?: string;
  description?: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface GraduateProgram {
  id: string;
  companyId?: string;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string;
  statusId: string;
  status?: GraduateProgramStatusOption;
  locationIds: string[];
  locations?: GraduateProgramLocationOption[];
  trackTags: CareerTrack[];
  requirements: GraduateProgramRequirementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface GraduateProgramSettings {
  statuses: GraduateProgramStatusOption[];
  locations: GraduateProgramLocationOption[];
  requirementTypes: GraduateProgramRequirementType[];
}
