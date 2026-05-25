import type {
  BachelorFile,
  BachelorFolder,
  BachelorFolderTreeNode,
  BachelorKnowledge,
  BoardGraph,
  BoardViewport,
  CareerBoard,
  CareerBoardSummary,
  CareerMapNode,
  CareerPath,
  CareerPathStep,
  CareerTrack,
  CareerTrackSetting,
  Company,
  CompetitionEntry,
  CompetitionFormat,
  CompetitionScope,
  CompetitionStatus,
  CompetitionType,
  CoursePlan,
  CourseStatus,
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

export interface CompanyQuery {
  q?: string;
  track?: CareerTrack;
  tier?: number;
  geography?: string;
}

export interface CompanyInput {
  name: string;
  description: string;
  tracks: CareerTrack[];
  tier: 1 | 2 | 3;
  geography: string;
  roleTypes: string[];
  difficulty: Company["difficulty"];
  upside: Company["upside"];
  relevanceScore: number;
  websiteUrl?: string;
}

export interface PathInput {
  name: string;
  description: string;
  targetRole: string;
  horizon: string;
  steps: Array<Omit<CareerPathStep, "id" | "company">>;
}

export interface CareerMapNodeInput {
  title: string;
  items: string[];
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
  companyId?: string | null;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline?: Date | null;
  statusId: string;
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
  companyId?: string | null;
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

export class CompanyDuplicateError extends Error {
  constructor(message = "En bedrift med dette navnet finnes allerede.") {
    super(message);
    this.name = "CompanyDuplicateError";
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

export interface BachelorKnowledgeInput {
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

export interface BoardCreateInput {
  name: string;
  description: string;
  graph?: BoardGraph;
  isDefault?: boolean;
}

export interface BoardUpdateInput {
  name?: string;
  description?: string;
  viewport?: BoardViewport | null;
  graph?: BoardGraph;
  isDefault?: boolean;
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
  getCareerMap(): Promise<{ nodes: CareerMapNode[]; tracks: CareerTrackSetting[] }>;
  updateCareerMapNode(id: string, input: CareerMapNodeInput): Promise<CareerMapNode | null>;
  resetCareerMapNode(id: string): Promise<CareerMapNode | null>;
  listCareerTracks(): Promise<CareerTrackSetting[]>;
  updateCareerTrack(id: CareerTrack, input: CareerTrackInput): Promise<CareerTrackSetting | null>;
  resetCareerTrack(id: CareerTrack): Promise<CareerTrackSetting | null>;
  deleteCareerTrack(id: CareerTrack): Promise<boolean>;
  listCourses(userId: string): Promise<CoursePlan[]>;
  createCourse(userId: string, input: CourseInput): Promise<CoursePlan>;
  updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null>;
  deleteCourse(userId: string, id: string): Promise<boolean>;
  listCompanies(query: CompanyQuery): Promise<Company[]>;
  createCompany(input: CompanyInput): Promise<Company>;
  listPaths(userId: string): Promise<CareerPath[]>;
  getPath(userId: string, id: string): Promise<CareerPath | null>;
  createPath(userId: string, input: PathInput): Promise<CareerPath>;
  updatePath(userId: string, id: string, input: PathInput): Promise<CareerPath | null>;
  deletePath(userId: string, id: string): Promise<boolean>;
  listCompetitions(userId: string): Promise<CompetitionEntry[]>;
  createCompetition(userId: string, input: CompetitionInput): Promise<CompetitionEntry>;
  updateCompetition(userId: string, id: string, input: CompetitionInput): Promise<CompetitionEntry | null>;
  deleteCompetition(userId: string, id: string): Promise<boolean>;
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
  listBachelorKnowledge(userId: string): Promise<BachelorKnowledge[]>;
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
  listBoards(userId: string): Promise<CareerBoardSummary[]>;
  getBoard(userId: string, id: string): Promise<CareerBoard | null>;
  createBoard(userId: string, input: BoardCreateInput): Promise<CareerBoard>;
  updateBoard(userId: string, id: string, input: BoardUpdateInput): Promise<CareerBoard | null>;
  deleteBoard(userId: string, id: string): Promise<boolean>;
  duplicateBoard(userId: string, id: string): Promise<CareerBoard | null>;
}
