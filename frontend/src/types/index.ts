import type {
  CareerTrack,
  CompetitionFormat,
  CompetitionScope,
  CompetitionStatus,
  CompetitionType,
  CourseStatus,
  ThesisCompanySource,
  ThesisCompanyStatus,
  AiResourceConfigFormat,
  AiResourceKind,
  AiResourceStatus,
  AiResourceTargetTool,
  LearningStatus
} from "@careercenter/shared";

export interface CoursePayload {
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export interface TrackPayload {
  label: string;
}

export interface CompetitionPayload {
  title: string;
  type: CompetitionType;
  scope: CompetitionScope;
  format: CompetitionFormat;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  location: string;
  organizer: string;
  url?: string | null;
  status: CompetitionStatus;
  notes: string;
  sortOrder: number;
}

export interface ThesisCompanyPayload {
  companyName: string;
  topicArea: string;
  status: ThesisCompanyStatus;
  source: ThesisCompanySource;
  location: string;
  contactPerson: string;
  websiteUrl?: string | null;
  targetSemester?: 7 | 8 | 9 | 10 | null;
  trackTags: CareerTrack[];
  notes: string;
  sortOrder: number;
}

export interface SelfStudyCoursePayload {
  title: string;
  provider: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  completedAt?: string | null;
  sortOrder: number;
}

export interface EducationBookPayload {
  title: string;
  author?: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  sortOrder: number;
}

export interface LearningPlatformPayload {
  name: string;
  url?: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}

export interface AiResourcePayload {
  name: string;
  kind: AiResourceKind;
  targetTools: AiResourceTargetTool[];
  status: AiResourceStatus;
  tags: string[];
  installPath: string;
  content: string;
  frontmatter: Record<string, unknown>;
  configFormat: AiResourceConfigFormat;
  notes: string;
  folderPath: string;
  isStarred: boolean;
  usageCount: number;
  lastUsedAt?: string | null;
  sourcePath?: string;
}

export interface AiResourceImportPayload {
  files: Array<{
    fileName: string;
    content: string;
  }>;
}

export interface BachelorKnowledgePayload {
  folderId?: string | null;
  courseName: string;
  topic: string;
  notes: string;
  sortOrder: number;
}

export interface BachelorFolderPayload {
  name: string;
  parentId?: string | null;
  sortOrder: number;
}

export interface BachelorFileUpdatePayload {
  originalName?: string;
  folderId?: string | null;
  notes?: string;
  sortOrder?: number;
}

export interface InternshipRequirementItemPayload {
  requirementTypeId: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface InternshipPayload {
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string | null;
  statusId: string;
  locationIds: string[];
  trackTags: CareerTrack[];
  requirements: InternshipRequirementItemPayload[];
}

export interface GraduateProgramRequirementItemPayload {
  requirementTypeId: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface GraduateProgramPayload {
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: string | null;
  statusId: string;
  locationIds: string[];
  trackTags: CareerTrack[];
  requirements: GraduateProgramRequirementItemPayload[];
}

export interface CatalogLabelPayload {
  label: string;
  sortOrder?: number;
  description?: string;
}
