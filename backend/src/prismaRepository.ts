import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AiResource,
  BachelorFile,
  BachelorFolder,
  BachelorFolderTreeNode,
  BachelorKnowledge,
  CareerTrack,
  CareerTrackSetting,
  CompetitionEntry,
  CoursePlan,
  EducationBook,
  LearningPlatform,
  SelfStudyCourse,
  ThesisCompany,
  UserProfile,
  assertSemester
} from "@careercenter/shared";
import { InvalidReferenceError } from "./repository.js";
import type {
  BachelorFileCreateInput,
  BachelorFileUpdateInput,
  BachelorFolderInput,
  BachelorKnowledgeInput,
  CareerTrackInput,
  CompetitionInput,
  CourseInput,
  EducationBookInput,
  AiResourceInput,
  LearningPlatformInput,
  Repository,
  SelfStudyCourseInput,
  ThesisCompanyInput
} from "./repository.js";
import { createPrismaGraduateProgramRepository } from "./graduateProgramRepositoryImpl.js";
import { createPrismaInternshipRepository } from "./internshipRepositoryImpl.js";
import { bootstrapNewUser } from "./auth/bootstrapUser.js";
import type { AuthUserRecord } from "./repository.js";

type CourseRow = {
  id: string;
  userId: string;
  semester: number;
  courseCode: string;
  title: string;
  credits: number;
  status: string;
  notes: string;
  trackTags: string[];
  sortOrder: number;
};

type TrackRow = {
  id: CareerTrack;
  defaultLabel: string;
  label: string;
  sortOrder: number;
};

type CompetitionRow = {
  id: string;
  userId: string;
  title: string;
  type: string;
  scope: string;
  format: string;
  startDate: Date | null;
  endDate: Date | null;
  registrationDeadline: Date | null;
  location: string;
  organizer: string;
  url: string | null;
  status: string;
  notes: string;
  sortOrder: number;
};

type ThesisCompanyRow = {
  id: string;
  userId: string;
  companyName: string;
  topicArea: string;
  status: string;
  source: string;
  location: string;
  contactPerson: string;
  websiteUrl: string | null;
  targetSemester: number | null;
  trackTags: string[];
  notes: string;
  sortOrder: number;
};

type SelfStudyCourseRow = {
  id: string;
  userId: string;
  title: string;
  provider: string;
  status: string;
  url: string | null;
  notes: string;
  completedAt: Date | null;
  sortOrder: number;
};

type EducationBookRow = {
  id: string;
  userId: string;
  title: string;
  author: string | null;
  status: string;
  url: string | null;
  notes: string;
  sortOrder: number;
};

type LearningPlatformRow = {
  id: string;
  userId: string;
  name: string;
  url: string | null;
  notes: string;
  isActive: boolean;
  sortOrder: number;
};

type AiResourceRow = {
  id: string;
  userId: string;
  name: string;
  kind: string;
  targetTools: string[];
  status: string;
  tags: string[];
  installPath: string;
  content: string;
  frontmatter: unknown;
  configFormat: string;
  notes: string;
  folderPath: string;
  isStarred: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  sourcePath: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BachelorKnowledgeRow = {
  id: string;
  userId: string;
  folderId: string | null;
  courseName: string;
  topic: string;
  notes: string;
  sortOrder: number;
};

type BachelorFolderRow = {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: Date;
};

type BachelorFileRow = {
  id: string;
  userId: string;
  folderId: string | null;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  notes: string;
  sortOrder: number;
  createdAt: Date;
};

export class PrismaRepository implements Repository {
  private readonly internshipRepo;
  private readonly graduateProgramRepo;

  constructor(private prisma = new PrismaClient()) {
    this.internshipRepo = createPrismaInternshipRepository(prisma);
    this.graduateProgramRepo = createPrismaGraduateProgramRepository(prisma);
  }

  async findUserByName(name: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { name } });
    return user ? this.mapAuthUser(user) : null;
  }

  async findUserByIdForAuth(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.mapAuthUser(user) : null;
  }

  async createUser(name: string, pinHash: string) {
    const user = await this.prisma.user.create({
      data: { name, pinHash },
      select: { id: true, name: true }
    });
    return user;
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true }
    });
    return user;
  }

  async incrementFailedAttempts(id: string): Promise<AuthUserRecord> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } }
    });
    return this.mapAuthUser(user);
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedAttempts: 0, lockedUntil: null }
    });
  }

  async lockUser(id: string, until: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: until }
    });
  }

  async initializeNewUser(userId: string): Promise<void> {
    await bootstrapNewUser(this.prisma, userId);
  }

  private mapAuthUser(user: {
    id: string;
    name: string;
    pinHash: string;
    failedAttempts: number;
    lockedUntil: Date | null;
  }): AuthUserRecord {
    return {
      id: user.id,
      name: user.name,
      pinHash: user.pinHash,
      failedAttempts: user.failedAttempts,
      lockedUntil: user.lockedUntil
    };
  }

  async listCareerTracks(): Promise<CareerTrackSetting[]> {
    const rows = (await this.prisma.careerTrackSetting.findMany({ orderBy: { sortOrder: "asc" } })) as TrackRow[];
    return rows.map((row) => this.mapTrack(row));
  }

  async updateCareerTrack(id: CareerTrack, input: CareerTrackInput): Promise<CareerTrackSetting | null> {
    const existing = await this.prisma.careerTrackSetting.findUnique({ where: { id } });
    if (!existing) return null;
    return this.mapTrack((await this.prisma.careerTrackSetting.update({ where: { id }, data: { label: input.label } })) as TrackRow);
  }

  async resetCareerTrack(id: CareerTrack): Promise<CareerTrackSetting | null> {
    const existing = await this.prisma.careerTrackSetting.findUnique({ where: { id } });
    if (!existing) return null;
    return this.mapTrack((await this.prisma.careerTrackSetting.update({ where: { id }, data: { label: existing.defaultLabel } })) as TrackRow);
  }

  async deleteCareerTrack(id: CareerTrack): Promise<boolean> {
    const existing = await this.prisma.careerTrackSetting.findUnique({ where: { id } });
    if (!existing) return false;
    await this.prisma.careerTrackSetting.delete({ where: { id } });
    return true;
  }

  async listCourses(userId: string): Promise<CoursePlan[]> {
    const rows = (await this.prisma.coursePlan.findMany({ where: { userId }, orderBy: [{ semester: "asc" }, { sortOrder: "asc" }] })) as CourseRow[];
    return rows.map((row) => this.mapCourse(row));
  }

  async createCourse(userId: string, input: CourseInput): Promise<CoursePlan> {
    return this.mapCourse((await this.prisma.coursePlan.create({ data: { userId, ...input } })) as CourseRow);
  }

  async updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null> {
    const existing = await this.prisma.coursePlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapCourse((await this.prisma.coursePlan.update({ where: { id }, data: input })) as CourseRow);
  }

  async deleteCourse(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.coursePlan.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listCompetitions(userId: string): Promise<CompetitionEntry[]> {
    const rows = (await this.prisma.competitionEntry.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }]
    })) as CompetitionRow[];
    return rows.map((row) => this.mapCompetition(row));
  }

  async createCompetition(userId: string, input: CompetitionInput): Promise<CompetitionEntry> {
    return this.mapCompetition(
      (await this.prisma.competitionEntry.create({ data: { userId, ...input } })) as CompetitionRow
    );
  }

  async updateCompetition(userId: string, id: string, input: CompetitionInput): Promise<CompetitionEntry | null> {
    const existing = await this.prisma.competitionEntry.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapCompetition(
      (await this.prisma.competitionEntry.update({ where: { id }, data: input })) as CompetitionRow
    );
  }

  async deleteCompetition(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.competitionEntry.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listThesisCompanies(userId: string): Promise<ThesisCompany[]> {
    const rows = (await this.prisma.thesisCompany.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { companyName: "asc" }]
    })) as ThesisCompanyRow[];
    return rows.map((row) => this.mapThesisCompany(row));
  }

  async createThesisCompany(userId: string, input: ThesisCompanyInput): Promise<ThesisCompany> {
    return this.mapThesisCompany(
      (await this.prisma.thesisCompany.create({ data: { userId, ...input } })) as ThesisCompanyRow
    );
  }

  async updateThesisCompany(userId: string, id: string, input: ThesisCompanyInput): Promise<ThesisCompany | null> {
    const existing = await this.prisma.thesisCompany.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapThesisCompany(
      (await this.prisma.thesisCompany.update({ where: { id }, data: input })) as ThesisCompanyRow
    );
  }

  async deleteThesisCompany(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.thesisCompany.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listSelfStudyCourses(userId: string): Promise<SelfStudyCourse[]> {
    const rows = (await this.prisma.selfStudyCourse.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" }
    })) as SelfStudyCourseRow[];
    return rows.map((row) => this.mapSelfStudyCourse(row));
  }

  async createSelfStudyCourse(userId: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse> {
    return this.mapSelfStudyCourse(
      (await this.prisma.selfStudyCourse.create({ data: { userId, ...input } })) as SelfStudyCourseRow
    );
  }

  async updateSelfStudyCourse(userId: string, id: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse | null> {
    const existing = await this.prisma.selfStudyCourse.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapSelfStudyCourse(
      (await this.prisma.selfStudyCourse.update({ where: { id }, data: input })) as SelfStudyCourseRow
    );
  }

  async deleteSelfStudyCourse(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.selfStudyCourse.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listEducationBooks(userId: string): Promise<EducationBook[]> {
    const rows = (await this.prisma.educationBook.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" }
    })) as EducationBookRow[];
    return rows.map((row) => this.mapEducationBook(row));
  }

  async createEducationBook(userId: string, input: EducationBookInput): Promise<EducationBook> {
    return this.mapEducationBook((await this.prisma.educationBook.create({ data: { userId, ...input } })) as EducationBookRow);
  }

  async updateEducationBook(userId: string, id: string, input: EducationBookInput): Promise<EducationBook | null> {
    const existing = await this.prisma.educationBook.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapEducationBook((await this.prisma.educationBook.update({ where: { id }, data: input })) as EducationBookRow);
  }

  async deleteEducationBook(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.educationBook.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listLearningPlatforms(userId: string): Promise<LearningPlatform[]> {
    const rows = (await this.prisma.learningPlatform.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" }
    })) as LearningPlatformRow[];
    return rows.map((row) => this.mapLearningPlatform(row));
  }

  async createLearningPlatform(userId: string, input: LearningPlatformInput): Promise<LearningPlatform> {
    return this.mapLearningPlatform(
      (await this.prisma.learningPlatform.create({ data: { userId, ...input } })) as LearningPlatformRow
    );
  }

  async updateLearningPlatform(userId: string, id: string, input: LearningPlatformInput): Promise<LearningPlatform | null> {
    const existing = await this.prisma.learningPlatform.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapLearningPlatform(
      (await this.prisma.learningPlatform.update({ where: { id }, data: input })) as LearningPlatformRow
    );
  }

  async deleteLearningPlatform(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.learningPlatform.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listAiResources(userId: string): Promise<AiResource[]> {
    const rows = (await this.prisma.aiResource.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
    })) as AiResourceRow[];
    return rows.map((row) => this.mapAiResource(row));
  }

  async createAiResource(userId: string, input: AiResourceInput): Promise<AiResource> {
    return this.mapAiResource(
      (await this.prisma.aiResource.create({
        data: {
          userId,
          ...input,
          lastUsedAt: input.lastUsedAt ? new Date(input.lastUsedAt) : null,
          frontmatter: input.frontmatter as Prisma.InputJsonValue
        }
      })) as AiResourceRow
    );
  }

  async updateAiResource(userId: string, id: string, input: AiResourceInput): Promise<AiResource | null> {
    const existing = await this.prisma.aiResource.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapAiResource(
      (await this.prisma.aiResource.update({
        where: { id },
        data: {
          ...input,
          lastUsedAt: input.lastUsedAt ? new Date(input.lastUsedAt) : null,
          frontmatter: input.frontmatter as Prisma.InputJsonValue
        }
      })) as AiResourceRow
    );
  }

  async markAiResourceUsed(userId: string, id: string): Promise<AiResource | null> {
    const existing = await this.prisma.aiResource.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapAiResource(
      (await this.prisma.aiResource.update({
        where: { id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date()
        }
      })) as AiResourceRow
    );
  }

  async deleteAiResource(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.aiResource.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listBachelorKnowledge(userId: string, folderId?: string | null): Promise<BachelorKnowledge[]> {
    const rows = (await this.prisma.bachelorKnowledge.findMany({
      where: { userId, folderId: folderId === undefined ? undefined : folderId },
      orderBy: { sortOrder: "asc" }
    })) as BachelorKnowledgeRow[];
    return rows.map((row) => this.mapBachelorKnowledge(row));
  }

  async createBachelorKnowledge(userId: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge> {
    return this.mapBachelorKnowledge(
      (await this.prisma.bachelorKnowledge.create({ data: { userId, ...input } })) as BachelorKnowledgeRow
    );
  }

  async updateBachelorKnowledge(userId: string, id: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge | null> {
    const existing = await this.prisma.bachelorKnowledge.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapBachelorKnowledge(
      (await this.prisma.bachelorKnowledge.update({ where: { id }, data: input })) as BachelorKnowledgeRow
    );
  }

  async deleteBachelorKnowledge(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.bachelorKnowledge.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listBachelorFolders(userId: string, parentId?: string | null): Promise<BachelorFolder[]> {
    const rows = (await this.prisma.bachelorFolder.findMany({
      where: { userId, parentId: parentId === undefined ? undefined : parentId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })) as BachelorFolderRow[];
    return rows.map((row) => this.mapBachelorFolder(row));
  }

  async getBachelorFolderTree(userId: string): Promise<BachelorFolderTreeNode[]> {
    const rows = (await this.prisma.bachelorFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    })) as BachelorFolderRow[];
    return this.buildFolderTree(rows.map((row) => this.mapBachelorFolder(row)));
  }

  async createBachelorFolder(userId: string, input: BachelorFolderInput): Promise<BachelorFolder> {
    if (input.parentId) {
      const parent = await this.prisma.bachelorFolder.findFirst({ where: { id: input.parentId, userId } });
      if (!parent) throw new InvalidReferenceError("Overordnet mappe finnes ikke.");
    }
    return this.mapBachelorFolder(
      (await this.prisma.bachelorFolder.create({
        data: { userId, name: input.name, parentId: input.parentId ?? null, sortOrder: input.sortOrder }
      })) as BachelorFolderRow
    );
  }

  async updateBachelorFolder(userId: string, id: string, input: BachelorFolderInput): Promise<BachelorFolder | null> {
    const existing = await this.prisma.bachelorFolder.findFirst({ where: { id, userId } });
    if (!existing) return null;
    if (input.parentId) {
      if (input.parentId === id) throw new InvalidReferenceError("En mappe kan ikke være sin egen overordnede.");
      const parent = await this.prisma.bachelorFolder.findFirst({ where: { id: input.parentId, userId } });
      if (!parent) throw new InvalidReferenceError("Overordnet mappe finnes ikke.");
    }
    return this.mapBachelorFolder(
      (await this.prisma.bachelorFolder.update({
        where: { id },
        data: { name: input.name, parentId: input.parentId ?? null, sortOrder: input.sortOrder }
      })) as BachelorFolderRow
    );
  }

  async deleteBachelorFolder(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.bachelorFolder.findFirst({ where: { id, userId } });
    if (!existing) return false;
    const result = await this.prisma.bachelorFolder.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listBachelorFiles(userId: string, folderId?: string | null): Promise<BachelorFile[]> {
    const rows = (await this.prisma.bachelorFile.findMany({
      where: { userId, folderId: folderId === undefined ? undefined : folderId },
      orderBy: [{ sortOrder: "asc" }, { originalName: "asc" }]
    })) as BachelorFileRow[];
    return rows.map((row) => this.mapBachelorFile(row));
  }

  async getBachelorFile(userId: string, id: string): Promise<BachelorFile | null> {
    const row = (await this.prisma.bachelorFile.findFirst({ where: { id, userId } })) as BachelorFileRow | null;
    return row ? this.mapBachelorFile(row) : null;
  }

  async getBachelorFileWithStorage(userId: string, id: string): Promise<(BachelorFile & { storagePath: string }) | null> {
    const row = (await this.prisma.bachelorFile.findFirst({ where: { id, userId } })) as BachelorFileRow | null;
    if (!row) return null;
    return { ...this.mapBachelorFile(row), storagePath: row.storagePath };
  }

  async createBachelorFile(userId: string, input: BachelorFileCreateInput): Promise<BachelorFile> {
    if (input.folderId) {
      const folder = await this.prisma.bachelorFolder.findFirst({ where: { id: input.folderId, userId } });
      if (!folder) throw new InvalidReferenceError("Mappe finnes ikke.");
    }
    return this.mapBachelorFile(
      (await this.prisma.bachelorFile.create({
        data: {
          userId,
          folderId: input.folderId ?? null,
          originalName: input.originalName,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          notes: input.notes ?? "",
          sortOrder: input.sortOrder ?? 0
        }
      })) as BachelorFileRow
    );
  }

  async updateBachelorFile(userId: string, id: string, input: BachelorFileUpdateInput): Promise<BachelorFile | null> {
    const existing = await this.prisma.bachelorFile.findFirst({ where: { id, userId } });
    if (!existing) return null;
    if (input.folderId) {
      const folder = await this.prisma.bachelorFolder.findFirst({ where: { id: input.folderId, userId } });
      if (!folder) throw new InvalidReferenceError("Mappe finnes ikke.");
    }
    return this.mapBachelorFile(
      (await this.prisma.bachelorFile.update({
        where: { id },
        data: {
          originalName: input.originalName,
          folderId: input.folderId === undefined ? undefined : input.folderId,
          notes: input.notes,
          sortOrder: input.sortOrder,
          storagePath: input.storagePath
        }
      })) as BachelorFileRow
    );
  }

  async deleteBachelorFile(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.bachelorFile.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listBachelorFilesInFolderRecursive(userId: string, folderId: string): Promise<BachelorFile[]> {
    const folderIds = await this.collectDescendantFolderIds(userId, folderId);
    const rows = (await this.prisma.bachelorFile.findMany({
      where: { userId, folderId: { in: folderIds } }
    })) as BachelorFileRow[];
    return rows.map((row) => this.mapBachelorFile(row));
  }

  private async collectDescendantFolderIds(userId: string, folderId: string): Promise<string[]> {
    const all = (await this.prisma.bachelorFolder.findMany({ where: { userId } })) as BachelorFolderRow[];
    const ids = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of all) {
        if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
          ids.add(row.id);
          changed = true;
        }
      }
    }
    return [...ids];
  }

  private buildFolderTree(folders: BachelorFolder[]): BachelorFolderTreeNode[] {
    const byParent = new Map<string | null, BachelorFolderTreeNode[]>();
    for (const folder of folders) {
      const node: BachelorFolderTreeNode = { ...folder, children: [] };
      const key = folder.parentId;
      const list = byParent.get(key) ?? [];
      list.push(node);
      byParent.set(key, list);
    }
    const attach = (nodes: BachelorFolderTreeNode[]): BachelorFolderTreeNode[] =>
      nodes.map((node) => ({
        ...node,
        children: attach(byParent.get(node.id) ?? [])
      }));
    return attach(byParent.get(null) ?? []);
  }

  private mapCourse(row: CourseRow): CoursePlan {
    return { ...row, semester: row.semester as CoursePlan["semester"], status: row.status as CoursePlan["status"], trackTags: row.trackTags as CoursePlan["trackTags"] };
  }

  private mapTrack(row: TrackRow): CareerTrackSetting {
    return {
      id: row.id,
      label: row.label,
      sortOrder: row.sortOrder
    };
  }

  private mapCompetition(row: CompetitionRow): CompetitionEntry {
    return {
      id: row.id,
      title: row.title,
      type: row.type as CompetitionEntry["type"],
      scope: row.scope as CompetitionEntry["scope"],
      format: row.format as CompetitionEntry["format"],
      startDate: row.startDate?.toISOString(),
      endDate: row.endDate?.toISOString(),
      registrationDeadline: row.registrationDeadline?.toISOString(),
      location: row.location,
      organizer: row.organizer,
      url: row.url ?? undefined,
      status: row.status as CompetitionEntry["status"],
      notes: row.notes,
      sortOrder: row.sortOrder
    };
  }

  private mapThesisCompany(row: ThesisCompanyRow): ThesisCompany {
    return {
      id: row.id,
      companyName: row.companyName,
      topicArea: row.topicArea,
      status: row.status as ThesisCompany["status"],
      source: row.source as ThesisCompany["source"],
      location: row.location,
      contactPerson: row.contactPerson,
      websiteUrl: row.websiteUrl ?? undefined,
      targetSemester: row.targetSemester ? assertSemester(row.targetSemester) : undefined,
      trackTags: row.trackTags as ThesisCompany["trackTags"],
      notes: row.notes,
      sortOrder: row.sortOrder
    };
  }

  private mapSelfStudyCourse(row: SelfStudyCourseRow): SelfStudyCourse {
    return {
      id: row.id,
      title: row.title,
      provider: row.provider,
      status: row.status as SelfStudyCourse["status"],
      url: row.url ?? undefined,
      notes: row.notes,
      completedAt: row.completedAt?.toISOString(),
      sortOrder: row.sortOrder
    };
  }

  private mapEducationBook(row: EducationBookRow): EducationBook {
    return {
      id: row.id,
      title: row.title,
      author: row.author ?? undefined,
      status: row.status as EducationBook["status"],
      url: row.url ?? undefined,
      notes: row.notes,
      sortOrder: row.sortOrder
    };
  }

  private mapLearningPlatform(row: LearningPlatformRow): LearningPlatform {
    return {
      id: row.id,
      name: row.name,
      url: row.url ?? undefined,
      notes: row.notes,
      isActive: row.isActive,
      sortOrder: row.sortOrder
    };
  }

  private mapAiResource(row: AiResourceRow): AiResource {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind as AiResource["kind"],
      targetTools: row.targetTools as AiResource["targetTools"],
      status: row.status as AiResource["status"],
      tags: row.tags,
      installPath: row.installPath,
      content: row.content,
      frontmatter: isRecord(row.frontmatter) ? row.frontmatter : {},
      configFormat: row.configFormat as AiResource["configFormat"],
      notes: row.notes,
      folderPath: row.folderPath || "Inbox",
      isStarred: row.isStarred === true,
      usageCount: row.usageCount ?? 0,
      lastUsedAt: row.lastUsedAt?.toISOString(),
      sourcePath: row.sourcePath ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapBachelorKnowledge(row: BachelorKnowledgeRow): BachelorKnowledge {
    return {
      id: row.id,
      folderId: row.folderId,
      courseName: row.courseName,
      topic: row.topic,
      notes: row.notes,
      sortOrder: row.sortOrder
    };
  }

  private mapBachelorFolder(row: BachelorFolderRow): BachelorFolder {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString()
    };
  }

  private mapBachelorFile(row: BachelorFileRow): BachelorFile {
    return {
      id: row.id,
      folderId: row.folderId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      notes: row.notes,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString()
    };
  }

  getInternshipSettings = (userId: string) => this.internshipRepo.getInternshipSettings(userId);
  createInternshipStatus = (userId: string, input: Parameters<typeof this.internshipRepo.createInternshipStatus>[1]) =>
    this.internshipRepo.createInternshipStatus(userId, input);
  updateInternshipStatus = (userId: string, id: string, input: Parameters<typeof this.internshipRepo.updateInternshipStatus>[2]) =>
    this.internshipRepo.updateInternshipStatus(userId, id, input);
  deleteInternshipStatus = (userId: string, id: string) => this.internshipRepo.deleteInternshipStatus(userId, id);
  createInternshipLocation = (userId: string, input: Parameters<typeof this.internshipRepo.createInternshipLocation>[1]) =>
    this.internshipRepo.createInternshipLocation(userId, input);
  updateInternshipLocation = (userId: string, id: string, input: Parameters<typeof this.internshipRepo.updateInternshipLocation>[2]) =>
    this.internshipRepo.updateInternshipLocation(userId, id, input);
  deleteInternshipLocation = (userId: string, id: string) => this.internshipRepo.deleteInternshipLocation(userId, id);
  createInternshipRequirementType = (userId: string, input: Parameters<typeof this.internshipRepo.createInternshipRequirementType>[1]) =>
    this.internshipRepo.createInternshipRequirementType(userId, input);
  updateInternshipRequirementType = (userId: string, id: string, input: Parameters<typeof this.internshipRepo.updateInternshipRequirementType>[2]) =>
    this.internshipRepo.updateInternshipRequirementType(userId, id, input);
  deleteInternshipRequirementType = (userId: string, id: string) => this.internshipRepo.deleteInternshipRequirementType(userId, id);
  listInternships = (userId: string, query: Parameters<typeof this.internshipRepo.listInternships>[1]) =>
    this.internshipRepo.listInternships(userId, query);
  createInternship = (userId: string, input: Parameters<typeof this.internshipRepo.createInternship>[1]) =>
    this.internshipRepo.createInternship(userId, input);
  updateInternship = (userId: string, id: string, input: Parameters<typeof this.internshipRepo.updateInternship>[2]) =>
    this.internshipRepo.updateInternship(userId, id, input);
  deleteInternship = (userId: string, id: string) => this.internshipRepo.deleteInternship(userId, id);

  getGraduateProgramSettings = (userId: string) => this.graduateProgramRepo.getGraduateProgramSettings(userId);
  createGraduateProgramStatus = (userId: string, input: Parameters<typeof this.graduateProgramRepo.createGraduateProgramStatus>[1]) =>
    this.graduateProgramRepo.createGraduateProgramStatus(userId, input);
  updateGraduateProgramStatus = (userId: string, id: string, input: Parameters<typeof this.graduateProgramRepo.updateGraduateProgramStatus>[2]) =>
    this.graduateProgramRepo.updateGraduateProgramStatus(userId, id, input);
  deleteGraduateProgramStatus = (userId: string, id: string) => this.graduateProgramRepo.deleteGraduateProgramStatus(userId, id);
  createGraduateProgramLocation = (userId: string, input: Parameters<typeof this.graduateProgramRepo.createGraduateProgramLocation>[1]) =>
    this.graduateProgramRepo.createGraduateProgramLocation(userId, input);
  updateGraduateProgramLocation = (userId: string, id: string, input: Parameters<typeof this.graduateProgramRepo.updateGraduateProgramLocation>[2]) =>
    this.graduateProgramRepo.updateGraduateProgramLocation(userId, id, input);
  deleteGraduateProgramLocation = (userId: string, id: string) => this.graduateProgramRepo.deleteGraduateProgramLocation(userId, id);
  createGraduateProgramRequirementType = (userId: string, input: Parameters<typeof this.graduateProgramRepo.createGraduateProgramRequirementType>[1]) =>
    this.graduateProgramRepo.createGraduateProgramRequirementType(userId, input);
  updateGraduateProgramRequirementType = (userId: string, id: string, input: Parameters<typeof this.graduateProgramRepo.updateGraduateProgramRequirementType>[2]) =>
    this.graduateProgramRepo.updateGraduateProgramRequirementType(userId, id, input);
  deleteGraduateProgramRequirementType = (userId: string, id: string) => this.graduateProgramRepo.deleteGraduateProgramRequirementType(userId, id);
  listGraduatePrograms = (userId: string, query: Parameters<typeof this.graduateProgramRepo.listGraduatePrograms>[1]) =>
    this.graduateProgramRepo.listGraduatePrograms(userId, query);
  createGraduateProgram = (userId: string, input: Parameters<typeof this.graduateProgramRepo.createGraduateProgram>[1]) =>
    this.graduateProgramRepo.createGraduateProgram(userId, input);
  updateGraduateProgram = (userId: string, id: string, input: Parameters<typeof this.graduateProgramRepo.updateGraduateProgram>[2]) =>
    this.graduateProgramRepo.updateGraduateProgram(userId, id, input);
  deleteGraduateProgram = (userId: string, id: string) => this.graduateProgramRepo.deleteGraduateProgram(userId, id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
