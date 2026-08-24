import type {
  AiResource,
  AiResourceConfigFormat,
  AiResourceKind,
  AiResourceStatus,
  AiResourceTargetTool,
  BachelorFile,
  BachelorFolder,
  BachelorFolderTreeNode,
  BachelorKnowledge,
  CareerTrack,
  CareerTrackSetting,
  CompetitionEntry,
  CompetitionFormat,
  CompetitionScope,
  CompetitionStatus,
  CompetitionType,
  CoursePlan,
  CourseStatus,
  ThesisCompany,
  ThesisCompanySource,
  ThesisCompanyStatus,
  EducationBook,
  LearningPlatform,
  GraduateProgram,
  GraduateProgramLocationOption,
  GraduateProgramRequirementType,
  GraduateProgramSettings,
  GraduateProgramStatusOption,
  Internship,
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipSettings,
  InternshipStatusOption,
  LearningStatus,
  SelfStudyCourse,
  UserProfile
} from "@careercenter/shared";

export interface AuthUserRecord {
  id: string;
  name: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export interface CourseInput {
  semester: 7 | 8 | 9 | 10;
  courseCode: string;
  title: string;
  credits: number;
  status: CourseStatus;
  notes: string;
  trackTags: CareerTrack[];
  sortOrder: number;
}

export interface CareerTrackInput {
  label: string;
}

export interface CompetitionInput {
  title: string;
  type: CompetitionType;
  scope: CompetitionScope;
  format: CompetitionFormat;
  startDate?: Date | null;
  endDate?: Date | null;
  registrationDeadline?: Date | null;
  location: string;
  organizer: string;
  url?: string | null;
  status: CompetitionStatus;
  notes: string;
  sortOrder: number;
}

export interface ThesisCompanyInput {
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

export interface InternshipQuery {
  q?: string;
  statusId?: string;
  locationId?: string;
  track?: CareerTrack;
}

export interface InternshipRequirementItemInput {
  requirementTypeId: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface InternshipInput {
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: Date | null;
  statusId: string;
  stageIds: string[];
  locationIds: string[];
  trackTags: CareerTrack[];
  requirements: InternshipRequirementItemInput[];
}

export interface GraduateProgramQuery {
  q?: string;
  statusId?: string;
  locationId?: string;
  track?: CareerTrack;
}

export interface GraduateProgramRequirementItemInput {
  requirementTypeId: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface GraduateProgramInput {
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: Date | null;
  statusId: string;
  locationIds: string[];
  trackTags: CareerTrack[];
  requirements: GraduateProgramRequirementItemInput[];
}

export interface CatalogLabelInput {
  label: string;
  sortOrder?: number;
  description?: string;
  kind?: "stage" | "outcome";
}

export class CatalogInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogInUseError";
  }
}

export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReferenceError";
  }
}

export interface SelfStudyCourseInput {
  title: string;
  provider: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  completedAt?: Date | null;
  sortOrder: number;
}

export interface EducationBookInput {
  title: string;
  author?: string;
  status: LearningStatus;
  url?: string;
  notes: string;
  sortOrder: number;
}

export interface LearningPlatformInput {
  name: string;
  url?: string;
  notes: string;
  isActive: boolean;
  sortOrder: number;
}

export interface AiResourceInput {
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

export interface BachelorKnowledgeInput {
  folderId?: string | null;
  courseName: string;
  topic: string;
  notes: string;
  sortOrder: number;
}

export interface BachelorFolderInput {
  name: string;
  parentId?: string | null;
  sortOrder: number;
}

export interface BachelorFileCreateInput {
  folderId?: string | null;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  notes?: string;
  sortOrder?: number;
}

export interface BachelorFileUpdateInput {
  originalName?: string;
  folderId?: string | null;
  notes?: string;
  sortOrder?: number;
  storagePath?: string;
}

export interface Repository {
  findUserByName(name: string): Promise<AuthUserRecord | null>;
  findUserByIdForAuth(id: string): Promise<AuthUserRecord | null>;
  createUser(name: string, pinHash: string): Promise<UserProfile>;
  getUserById(id: string): Promise<UserProfile | null>;
  incrementFailedAttempts(id: string): Promise<AuthUserRecord>;
  resetFailedAttempts(id: string): Promise<void>;
  lockUser(id: string, until: Date): Promise<void>;
  initializeNewUser(userId: string): Promise<void>;
  listCareerTracks(): Promise<CareerTrackSetting[]>;
  updateCareerTrack(id: CareerTrack, input: CareerTrackInput): Promise<CareerTrackSetting | null>;
  resetCareerTrack(id: CareerTrack): Promise<CareerTrackSetting | null>;
  deleteCareerTrack(id: CareerTrack): Promise<boolean>;
  listCourses(userId: string): Promise<CoursePlan[]>;
  createCourse(userId: string, input: CourseInput): Promise<CoursePlan>;
  updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null>;
  deleteCourse(userId: string, id: string): Promise<boolean>;
  listCompetitions(userId: string): Promise<CompetitionEntry[]>;
  createCompetition(userId: string, input: CompetitionInput): Promise<CompetitionEntry>;
  updateCompetition(userId: string, id: string, input: CompetitionInput): Promise<CompetitionEntry | null>;
  deleteCompetition(userId: string, id: string): Promise<boolean>;
  listThesisCompanies(userId: string): Promise<ThesisCompany[]>;
  createThesisCompany(userId: string, input: ThesisCompanyInput): Promise<ThesisCompany>;
  updateThesisCompany(userId: string, id: string, input: ThesisCompanyInput): Promise<ThesisCompany | null>;
  deleteThesisCompany(userId: string, id: string): Promise<boolean>;
  listSelfStudyCourses(userId: string): Promise<SelfStudyCourse[]>;
  createSelfStudyCourse(userId: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse>;
  updateSelfStudyCourse(userId: string, id: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse | null>;
  deleteSelfStudyCourse(userId: string, id: string): Promise<boolean>;
  listEducationBooks(userId: string): Promise<EducationBook[]>;
  createEducationBook(userId: string, input: EducationBookInput): Promise<EducationBook>;
  updateEducationBook(userId: string, id: string, input: EducationBookInput): Promise<EducationBook | null>;
  deleteEducationBook(userId: string, id: string): Promise<boolean>;
  listLearningPlatforms(userId: string): Promise<LearningPlatform[]>;
  createLearningPlatform(userId: string, input: LearningPlatformInput): Promise<LearningPlatform>;
  updateLearningPlatform(userId: string, id: string, input: LearningPlatformInput): Promise<LearningPlatform | null>;
  deleteLearningPlatform(userId: string, id: string): Promise<boolean>;
  listAiResources(userId: string): Promise<AiResource[]>;
  createAiResource(userId: string, input: AiResourceInput): Promise<AiResource>;
  updateAiResource(userId: string, id: string, input: AiResourceInput): Promise<AiResource | null>;
  markAiResourceUsed(userId: string, id: string): Promise<AiResource | null>;
  deleteAiResource(userId: string, id: string): Promise<boolean>;
  listBachelorKnowledge(userId: string, folderId?: string | null): Promise<BachelorKnowledge[]>;
  createBachelorKnowledge(userId: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge>;
  updateBachelorKnowledge(userId: string, id: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge | null>;
  deleteBachelorKnowledge(userId: string, id: string): Promise<boolean>;
  listBachelorFolders(userId: string, parentId?: string | null): Promise<BachelorFolder[]>;
  getBachelorFolderTree(userId: string): Promise<BachelorFolderTreeNode[]>;
  createBachelorFolder(userId: string, input: BachelorFolderInput): Promise<BachelorFolder>;
  updateBachelorFolder(userId: string, id: string, input: BachelorFolderInput): Promise<BachelorFolder | null>;
  deleteBachelorFolder(userId: string, id: string): Promise<boolean>;
  listBachelorFiles(userId: string, folderId?: string | null): Promise<BachelorFile[]>;
  getBachelorFile(userId: string, id: string): Promise<BachelorFile | null>;
  getBachelorFileWithStorage(userId: string, id: string): Promise<(BachelorFile & { storagePath: string }) | null>;
  createBachelorFile(userId: string, input: BachelorFileCreateInput): Promise<BachelorFile>;
  updateBachelorFile(userId: string, id: string, input: BachelorFileUpdateInput): Promise<BachelorFile | null>;
  deleteBachelorFile(userId: string, id: string): Promise<boolean>;
  listBachelorFilesInFolderRecursive(userId: string, folderId: string): Promise<BachelorFile[]>;
  getInternshipSettings(userId: string): Promise<InternshipSettings>;
  createInternshipStatus(userId: string, input: CatalogLabelInput): Promise<InternshipStatusOption>;
  updateInternshipStatus(userId: string, id: string, input: CatalogLabelInput): Promise<InternshipStatusOption | null>;
  reorderInternshipStatuses(userId: string, ids: string[]): Promise<InternshipStatusOption[]>;
  deleteInternshipStatus(userId: string, id: string): Promise<boolean>;
  createInternshipLocation(userId: string, input: CatalogLabelInput): Promise<InternshipLocationOption>;
  updateInternshipLocation(userId: string, id: string, input: CatalogLabelInput): Promise<InternshipLocationOption | null>;
  deleteInternshipLocation(userId: string, id: string): Promise<boolean>;
  createInternshipRequirementType(userId: string, input: CatalogLabelInput): Promise<InternshipRequirementType>;
  updateInternshipRequirementType(userId: string, id: string, input: CatalogLabelInput): Promise<InternshipRequirementType | null>;
  deleteInternshipRequirementType(userId: string, id: string): Promise<boolean>;
  listInternships(userId: string, query: InternshipQuery): Promise<Internship[]>;
  createInternship(userId: string, input: InternshipInput): Promise<Internship>;
  updateInternship(userId: string, id: string, input: InternshipInput): Promise<Internship | null>;
  deleteInternship(userId: string, id: string): Promise<boolean>;
  getGraduateProgramSettings(userId: string): Promise<GraduateProgramSettings>;
  createGraduateProgramStatus(userId: string, input: CatalogLabelInput): Promise<GraduateProgramStatusOption>;
  updateGraduateProgramStatus(userId: string, id: string, input: CatalogLabelInput): Promise<GraduateProgramStatusOption | null>;
  deleteGraduateProgramStatus(userId: string, id: string): Promise<boolean>;
  createGraduateProgramLocation(userId: string, input: CatalogLabelInput): Promise<GraduateProgramLocationOption>;
  updateGraduateProgramLocation(userId: string, id: string, input: CatalogLabelInput): Promise<GraduateProgramLocationOption | null>;
  deleteGraduateProgramLocation(userId: string, id: string): Promise<boolean>;
  createGraduateProgramRequirementType(userId: string, input: CatalogLabelInput): Promise<GraduateProgramRequirementType>;
  updateGraduateProgramRequirementType(userId: string, id: string, input: CatalogLabelInput): Promise<GraduateProgramRequirementType | null>;
  deleteGraduateProgramRequirementType(userId: string, id: string): Promise<boolean>;
  listGraduatePrograms(userId: string, query: GraduateProgramQuery): Promise<GraduateProgram[]>;
  createGraduateProgram(userId: string, input: GraduateProgramInput): Promise<GraduateProgram>;
  updateGraduateProgram(userId: string, id: string, input: GraduateProgramInput): Promise<GraduateProgram | null>;
  deleteGraduateProgram(userId: string, id: string): Promise<boolean>;
}
