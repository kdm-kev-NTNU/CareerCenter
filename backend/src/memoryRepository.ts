import { nanoid } from "nanoid";
import type {
  AiResource,
  BachelorFile,
  BachelorFolder,
  BachelorFolderTreeNode,
  BachelorKnowledge,
  CareerBoard,
  CareerBoardSummary,
  CareerMapNode,
  CareerTrack,
  CareerTrackSetting,
  Company,
  CompetitionEntry,
  CoursePlan,
  EducationBook,
  LearningPlatform,
  SelfStudyCourse,
  UserProfile
} from "@careercenter/shared";
import { buildDefaultBoardGraph } from "./boardGraphSeed.js";
import { companies as seededCompanies, careerMapNodeSeeds, careerTrackSeeds } from "./seedData.js";
import { CompanyDuplicateError } from "./repository.js";
import type {
  BachelorFileCreateInput,
  BachelorFileUpdateInput,
  BachelorFolderInput,
  BachelorKnowledgeInput,
  BoardCreateInput,
  BoardUpdateInput,
  CareerMapNodeInput,
  CareerTrackInput,
  CompanyInput,
  CompanyQuery,
  CompetitionInput,
  CourseInput,
  EducationBookInput,
  AiResourceInput,
  LearningPlatformInput,
  Repository,
  SelfStudyCourseInput
} from "./repository.js";
import { createMemoryGraduateProgramRepository } from "./graduateProgramMemoryRepositoryImpl.js";
import { createMemoryInternshipRepository } from "./internshipMemoryRepositoryImpl.js";
import type { AuthUserRecord } from "./repository.js";

type StoredTrack = CareerTrackSetting & { defaultLabel: string };
type StoredNode = CareerMapNode & { defaultTitle: string; defaultItems: string[]; sortOrder: number };

export class MemoryRepository implements Repository {
  private companies = [...seededCompanies];
  private readonly internshipRepo;
  private readonly graduateProgramRepo;
  private users = new Map<string, AuthUserRecord>();
  private usersByName = new Map<string, string>();
  private courses = new Map<string, CoursePlan & { userId: string }>();
  private competitions = new Map<string, CompetitionEntry & { userId: string }>();
  private selfStudyCourses = new Map<string, SelfStudyCourse & { userId: string }>();
  private educationBooks = new Map<string, EducationBook & { userId: string }>();
  private learningPlatforms = new Map<string, LearningPlatform & { userId: string }>();
  private aiResources = new Map<string, AiResource & { userId: string }>();
  private bachelorKnowledge = new Map<string, BachelorKnowledge & { userId: string }>();
  private bachelorFolders = new Map<string, BachelorFolder & { userId: string }>();
  private bachelorFiles = new Map<string, BachelorFile & { userId: string; storagePath: string }>();
  private tracks = new Map<string, StoredTrack>(careerTrackSeeds.map((track) => [track.id, { ...track, defaultLabel: track.label }]));

  constructor() {
    const companyExists = (companyId: string) => this.companies.some((company) => company.id === companyId);
    this.internshipRepo = createMemoryInternshipRepository({ companyExists });
    this.graduateProgramRepo = createMemoryGraduateProgramRepository({ companyExists });
  }
  private mapNodes = new Map<string, StoredNode>(
    careerMapNodeSeeds.map((node) => [
      node.id,
      {
        id: node.id,
        title: node.title,
        level: node.level,
        track: node.track,
        items: [...node.items],
        defaultTitle: node.defaultTitle,
        defaultItems: [...node.defaultItems],
        sortOrder: node.sortOrder
      }
    ])
  );
  private boards = new Map<string, CareerBoard & { userId: string }>();

  async findUserByName(name: string): Promise<AuthUserRecord | null> {
    const id = this.usersByName.get(name);
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findUserByIdForAuth(id: string): Promise<AuthUserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(name: string, pinHash: string): Promise<UserProfile> {
    const id = nanoid();
    const record: AuthUserRecord = {
      id,
      name,
      pinHash,
      failedAttempts: 0,
      lockedUntil: null
    };
    this.users.set(id, record);
    this.usersByName.set(name, id);
    await this.ensureDefaultBoard(id);
    return { id, name };
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    const user = this.users.get(id);
    return user ? { id: user.id, name: user.name } : null;
  }

  async incrementFailedAttempts(id: string): Promise<AuthUserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    user.failedAttempts += 1;
    return { ...user };
  }

  async resetFailedAttempts(id: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;
    user.failedAttempts = 0;
    user.lockedUntil = null;
  }

  async lockUser(id: string, until: Date): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;
    user.lockedUntil = until;
  }

  async initializeNewUser(userId: string): Promise<void> {
    await this.ensureDefaultBoard(userId);
  }

  private async ensureDefaultBoard(userId: string) {
    const hasBoard = [...this.boards.values()].some((board) => board.userId === userId);
    if (hasBoard) return;
    const now = new Date().toISOString();
    const board: CareerBoard & { userId: string } = {
      id: "default-board",
      userId,
      name: "Karrierekart",
      description: "Standard kart med bedrifter og spor",
      viewport: { x: 0, y: 0, zoom: 0.75 },
      graph: buildDefaultBoardGraph(careerMapNodeSeeds, this.companies),
      isDefault: true,
      createdAt: now,
      updatedAt: now
    };
    this.boards.set(board.id, board);
  }

  async getCareerMap(): Promise<{ nodes: CareerMapNode[]; tracks: CareerTrackSetting[] }> {
    return {
      nodes: [...this.mapNodes.values()]
        .sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder)
        .map((node) => this.cloneNode(node)),
      tracks: [...this.tracks.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((track) => this.cloneTrack(track))
    };
  }

  async updateCareerMapNode(id: string, input: CareerMapNodeInput): Promise<CareerMapNode | null> {
    const existing = this.mapNodes.get(id);
    if (!existing) return null;
    const next = { ...existing, title: input.title, items: [...input.items] };
    this.mapNodes.set(id, next);
    return this.cloneNode(next);
  }

  async resetCareerMapNode(id: string): Promise<CareerMapNode | null> {
    const existing = this.mapNodes.get(id);
    if (!existing) return null;
    const next = { ...existing, title: existing.defaultTitle, items: [...existing.defaultItems] };
    this.mapNodes.set(id, next);
    return this.cloneNode(next);
  }

  async listCareerTracks(): Promise<CareerTrackSetting[]> {
    return [...this.tracks.values()].sort((a, b) => a.sortOrder - b.sortOrder).map((track) => this.cloneTrack(track));
  }

  async updateCareerTrack(id: CareerTrack, input: CareerTrackInput): Promise<CareerTrackSetting | null> {
    const existing = this.tracks.get(id);
    if (!existing) return null;
    const next = { ...existing, label: input.label };
    this.tracks.set(id, next);
    return this.cloneTrack(next);
  }

  async resetCareerTrack(id: CareerTrack): Promise<CareerTrackSetting | null> {
    const existing = this.tracks.get(id);
    if (!existing) return null;
    const next = { ...existing, label: existing.defaultLabel };
    this.tracks.set(id, next);
    return this.cloneTrack(next);
  }

  async deleteCareerTrack(id: CareerTrack): Promise<boolean> {
    return this.tracks.delete(id);
  }

  async listCourses(userId: string): Promise<CoursePlan[]> {
    return [...this.courses.values()]
      .filter((course) => course.userId === userId)
      .sort((a, b) => a.semester - b.semester || a.sortOrder - b.sortOrder);
  }

  async createCourse(userId: string, input: CourseInput): Promise<CoursePlan> {
    const course = { id: nanoid(), userId, ...input };
    this.courses.set(course.id, course);
    return course;
  }

  async updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null> {
    const existing = this.courses.get(id);
    if (!existing || existing.userId !== userId) return null;
    const course = { id, userId, ...input };
    this.courses.set(id, course);
    return course;
  }

  async deleteCourse(userId: string, id: string): Promise<boolean> {
    const existing = this.courses.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.courses.delete(id);
  }

  async listCompanies(query: CompanyQuery): Promise<Company[]> {
    const search = query.q?.toLowerCase().trim();
    return this.companies
      .filter((company) => !search || [company.name, company.description, company.geography, ...company.roleTypes].join(" ").toLowerCase().includes(search))
      .filter((company) => !query.track || company.tracks.includes(query.track))
      .filter((company) => !query.tier || company.tier === query.tier)
      .filter((company) => !query.geography || company.geography.toLowerCase().includes(query.geography.toLowerCase()))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async createCompany(input: CompanyInput): Promise<Company> {
    const normalized = input.name.trim().toLowerCase();
    if (this.companies.some((company) => company.name.trim().toLowerCase() === normalized)) {
      throw new CompanyDuplicateError();
    }
    const company: Company = { id: nanoid(), ...input };
    this.companies.push(company);
    return company;
  }

  async listCompetitions(userId: string): Promise<CompetitionEntry[]> {
    return [...this.competitions.values()]
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.startDate ?? "").localeCompare(b.startDate ?? ""))
      .map((entry) => this.cloneCompetition(entry));
  }

  async createCompetition(userId: string, input: CompetitionInput): Promise<CompetitionEntry> {
    const entry = this.toCompetitionEntry(nanoid(), input);
    this.competitions.set(entry.id, { ...entry, userId });
    return entry;
  }

  async updateCompetition(userId: string, id: string, input: CompetitionInput): Promise<CompetitionEntry | null> {
    const existing = this.competitions.get(id);
    if (!existing || existing.userId !== userId) return null;
    const entry = this.toCompetitionEntry(id, input);
    this.competitions.set(id, { ...entry, userId });
    return entry;
  }

  async deleteCompetition(userId: string, id: string): Promise<boolean> {
    const existing = this.competitions.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.competitions.delete(id);
  }

  async listSelfStudyCourses(userId: string): Promise<SelfStudyCourse[]> {
    return [...this.selfStudyCourses.values()]
      .filter((course) => course.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createSelfStudyCourse(userId: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse> {
    const course = this.toSelfStudyCourse(nanoid(), input);
    this.selfStudyCourses.set(course.id, { ...course, userId });
    return course;
  }

  async updateSelfStudyCourse(userId: string, id: string, input: SelfStudyCourseInput): Promise<SelfStudyCourse | null> {
    const existing = this.selfStudyCourses.get(id);
    if (!existing || existing.userId !== userId) return null;
    const course = this.toSelfStudyCourse(id, input);
    this.selfStudyCourses.set(id, { ...course, userId });
    return course;
  }

  async deleteSelfStudyCourse(userId: string, id: string): Promise<boolean> {
    const existing = this.selfStudyCourses.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.selfStudyCourses.delete(id);
  }

  async listEducationBooks(userId: string): Promise<EducationBook[]> {
    return [...this.educationBooks.values()]
      .filter((book) => book.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createEducationBook(userId: string, input: EducationBookInput): Promise<EducationBook> {
    const book = this.toEducationBook(nanoid(), input);
    this.educationBooks.set(book.id, { ...book, userId });
    return book;
  }

  async updateEducationBook(userId: string, id: string, input: EducationBookInput): Promise<EducationBook | null> {
    const existing = this.educationBooks.get(id);
    if (!existing || existing.userId !== userId) return null;
    const book = this.toEducationBook(id, input);
    this.educationBooks.set(id, { ...book, userId });
    return book;
  }

  async deleteEducationBook(userId: string, id: string): Promise<boolean> {
    const existing = this.educationBooks.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.educationBooks.delete(id);
  }

  async listLearningPlatforms(userId: string): Promise<LearningPlatform[]> {
    return [...this.learningPlatforms.values()]
      .filter((platform) => platform.userId === userId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createLearningPlatform(userId: string, input: LearningPlatformInput): Promise<LearningPlatform> {
    const platform = this.toLearningPlatform(nanoid(), input);
    this.learningPlatforms.set(platform.id, { ...platform, userId });
    return platform;
  }

  async updateLearningPlatform(userId: string, id: string, input: LearningPlatformInput): Promise<LearningPlatform | null> {
    const existing = this.learningPlatforms.get(id);
    if (!existing || existing.userId !== userId) return null;
    const platform = this.toLearningPlatform(id, input);
    this.learningPlatforms.set(id, { ...platform, userId });
    return platform;
  }

  async deleteLearningPlatform(userId: string, id: string): Promise<boolean> {
    const existing = this.learningPlatforms.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.learningPlatforms.delete(id);
  }

  async listAiResources(userId: string): Promise<AiResource[]> {
    return [...this.aiResources.values()]
      .filter((resource) => resource.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))
      .map((resource) => this.cloneAiResource(resource));
  }

  async createAiResource(userId: string, input: AiResourceInput): Promise<AiResource> {
    const now = new Date().toISOString();
    const resource: AiResource & { userId: string } = {
      id: nanoid(),
      userId,
      ...this.toAiResourceInput(input),
      createdAt: now,
      updatedAt: now
    };
    this.aiResources.set(resource.id, resource);
    return this.cloneAiResource(resource);
  }

  async updateAiResource(userId: string, id: string, input: AiResourceInput): Promise<AiResource | null> {
    const existing = this.aiResources.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated: AiResource & { userId: string } = {
      ...existing,
      ...this.toAiResourceInput(input),
      updatedAt: new Date().toISOString()
    };
    this.aiResources.set(id, updated);
    return this.cloneAiResource(updated);
  }

  async deleteAiResource(userId: string, id: string): Promise<boolean> {
    const existing = this.aiResources.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.aiResources.delete(id);
  }

  async listBachelorKnowledge(userId: string, folderId?: string | null): Promise<BachelorKnowledge[]> {
    return [...this.bachelorKnowledge.values()]
      .filter(
        (entry) =>
          entry.userId === userId && (folderId === undefined || entry.folderId === folderId)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createBachelorKnowledge(userId: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge> {
    const entry = this.toBachelorKnowledge(nanoid(), input);
    this.bachelorKnowledge.set(entry.id, { ...entry, userId });
    return entry;
  }

  async updateBachelorKnowledge(userId: string, id: string, input: BachelorKnowledgeInput): Promise<BachelorKnowledge | null> {
    const existing = this.bachelorKnowledge.get(id);
    if (!existing || existing.userId !== userId) return null;
    const entry = this.toBachelorKnowledge(id, input);
    this.bachelorKnowledge.set(id, { ...entry, userId });
    return entry;
  }

  async deleteBachelorKnowledge(userId: string, id: string): Promise<boolean> {
    const existing = this.bachelorKnowledge.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.bachelorKnowledge.delete(id);
  }

  async listBachelorFolders(userId: string, parentId?: string | null): Promise<BachelorFolder[]> {
    return [...this.bachelorFolders.values()]
      .filter((f) => f.userId === userId && (parentId === undefined || f.parentId === parentId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async getBachelorFolderTree(userId: string): Promise<BachelorFolderTreeNode[]> {
    const folders = await this.listBachelorFolders(userId);
    const all = [...this.bachelorFolders.values()].filter((f) => f.userId === userId);
    const byParent = new Map<string | null, BachelorFolderTreeNode[]>();
    for (const folder of all) {
      const node: BachelorFolderTreeNode = {
        id: folder.id,
        parentId: folder.parentId,
        name: folder.name,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt,
        children: []
      };
      const list = byParent.get(folder.parentId) ?? [];
      list.push(node);
      byParent.set(folder.parentId, list);
    }
    const attach = (nodes: BachelorFolderTreeNode[]): BachelorFolderTreeNode[] =>
      nodes.map((node) => ({ ...node, children: attach(byParent.get(node.id) ?? []) }));
    void folders;
    return attach(byParent.get(null) ?? []);
  }

  async createBachelorFolder(userId: string, input: BachelorFolderInput): Promise<BachelorFolder> {
    const folder: BachelorFolder & { userId: string } = {
      id: nanoid(),
      userId,
      parentId: input.parentId ?? null,
      name: input.name,
      sortOrder: input.sortOrder,
      createdAt: new Date().toISOString()
    };
    this.bachelorFolders.set(folder.id, folder);
    return folder;
  }

  async updateBachelorFolder(userId: string, id: string, input: BachelorFolderInput): Promise<BachelorFolder | null> {
    const existing = this.bachelorFolders.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated = {
      ...existing,
      name: input.name,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder
    };
    this.bachelorFolders.set(id, updated);
    return updated;
  }

  async deleteBachelorFolder(userId: string, id: string): Promise<boolean> {
    const existing = this.bachelorFolders.get(id);
    if (!existing || existing.userId !== userId) return false;
    const toDelete = [...this.bachelorFolders.values()].filter(
      (f) => f.userId === userId && (f.id === id || this.isDescendantOf(f, id))
    );
    for (const folder of toDelete) {
      this.bachelorFolders.delete(folder.id);
      for (const file of [...this.bachelorFiles.values()].filter((file) => file.folderId === folder.id)) {
        this.bachelorFiles.delete(file.id);
      }
    }
    return true;
  }

  private isDescendantOf(folder: BachelorFolder, ancestorId: string): boolean {
    let current: string | null = folder.parentId;
    while (current) {
      if (current === ancestorId) return true;
      const parent = this.bachelorFolders.get(current);
      current = parent?.parentId ?? null;
    }
    return false;
  }

  async listBachelorFiles(userId: string, folderId?: string | null): Promise<BachelorFile[]> {
    return [...this.bachelorFiles.values()]
      .filter((f) => f.userId === userId && (folderId === undefined || f.folderId === folderId))
      .map(({ storagePath: _s, userId: _u, ...file }) => file)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.originalName.localeCompare(b.originalName));
  }

  async getBachelorFile(userId: string, id: string): Promise<BachelorFile | null> {
    const row = this.bachelorFiles.get(id);
    if (!row || row.userId !== userId) return null;
    const { storagePath: _s, userId: _u, ...file } = row;
    return file;
  }

  async getBachelorFileWithStorage(userId: string, id: string): Promise<(BachelorFile & { storagePath: string }) | null> {
    const row = this.bachelorFiles.get(id);
    if (!row || row.userId !== userId) return null;
    const { userId: _u, ...file } = row;
    return file;
  }

  async createBachelorFile(userId: string, input: BachelorFileCreateInput): Promise<BachelorFile> {
    const file: BachelorFile & { userId: string; storagePath: string } = {
      id: nanoid(),
      userId,
      folderId: input.folderId ?? null,
      originalName: input.originalName,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      notes: input.notes ?? "",
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date().toISOString()
    };
    this.bachelorFiles.set(file.id, file);
    const { storagePath: _s, userId: _u, ...publicFile } = file;
    return publicFile;
  }

  async updateBachelorFile(userId: string, id: string, input: BachelorFileUpdateInput): Promise<BachelorFile | null> {
    const existing = this.bachelorFiles.get(id);
    if (!existing || existing.userId !== userId) return null;
    const updated = {
      ...existing,
      originalName: input.originalName ?? existing.originalName,
      folderId: input.folderId === undefined ? existing.folderId : input.folderId,
      notes: input.notes ?? existing.notes,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      storagePath: input.storagePath ?? existing.storagePath
    };
    this.bachelorFiles.set(id, updated);
    const { storagePath: _s, userId: _u, ...file } = updated;
    return file;
  }

  async deleteBachelorFile(userId: string, id: string): Promise<boolean> {
    const existing = this.bachelorFiles.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.bachelorFiles.delete(id);
  }

  async listBachelorFilesInFolderRecursive(userId: string, folderId: string): Promise<BachelorFile[]> {
    const folderIds = new Set<string>([folderId]);
    for (const folder of this.bachelorFolders.values()) {
      if (folder.userId === userId && folder.parentId && folderIds.has(folder.parentId)) {
        folderIds.add(folder.id);
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of this.bachelorFolders.values()) {
        if (folder.userId === userId && folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
          folderIds.add(folder.id);
          changed = true;
        }
      }
    }
    return [...this.bachelorFiles.values()]
      .filter((f) => f.userId === userId && f.folderId && folderIds.has(f.folderId))
      .map(({ storagePath: _s, userId: _u, ...file }) => file);
  }

  private toSelfStudyCourse(id: string, input: SelfStudyCourseInput): SelfStudyCourse {
    return {
      id,
      title: input.title,
      provider: input.provider,
      status: input.status,
      url: input.url,
      notes: input.notes,
      completedAt: input.completedAt?.toISOString(),
      sortOrder: input.sortOrder
    };
  }

  private toEducationBook(id: string, input: EducationBookInput): EducationBook {
    return {
      id,
      title: input.title,
      author: input.author,
      status: input.status,
      url: input.url,
      notes: input.notes,
      sortOrder: input.sortOrder
    };
  }

  private toLearningPlatform(id: string, input: LearningPlatformInput): LearningPlatform {
    return {
      id,
      name: input.name,
      url: input.url,
      notes: input.notes,
      isActive: input.isActive,
      sortOrder: input.sortOrder
    };
  }

  private toAiResourceInput(input: AiResourceInput) {
    return {
      name: input.name,
      kind: input.kind,
      targetTools: [...input.targetTools],
      status: input.status,
      tags: [...input.tags],
      installPath: input.installPath,
      content: input.content,
      frontmatter: structuredClone(input.frontmatter),
      configFormat: input.configFormat,
      notes: input.notes
    };
  }

  private cloneAiResource(resource: AiResource & { userId?: string }): AiResource {
    const { userId: _userId, ...publicResource } = resource;
    return {
      ...publicResource,
      targetTools: [...resource.targetTools],
      tags: [...resource.tags],
      frontmatter: structuredClone(resource.frontmatter)
    };
  }

  private toBachelorKnowledge(id: string, input: BachelorKnowledgeInput): BachelorKnowledge {
    return {
      id,
      folderId: input.folderId ?? null,
      courseName: input.courseName,
      topic: input.topic,
      notes: input.notes,
      sortOrder: input.sortOrder
    };
  }

  private toCompetitionEntry(id: string, input: CompetitionInput): CompetitionEntry {
    return {
      id,
      title: input.title,
      type: input.type,
      scope: input.scope,
      format: input.format,
      startDate: input.startDate?.toISOString(),
      endDate: input.endDate?.toISOString(),
      registrationDeadline: input.registrationDeadline?.toISOString(),
      location: input.location,
      organizer: input.organizer,
      url: input.url ?? undefined,
      status: input.status,
      notes: input.notes,
      sortOrder: input.sortOrder
    };
  }

  private cloneCompetition(entry: CompetitionEntry): CompetitionEntry {
    return { ...entry };
  }

  private cloneNode(node: StoredNode): CareerMapNode {
    return {
      id: node.id,
      title: node.title,
      level: node.level,
      track: node.track,
      items: [...node.items]
    };
  }

  private cloneTrack(track: StoredTrack): CareerTrackSetting {
    return {
      id: track.id,
      label: track.label,
      sortOrder: track.sortOrder
    };
  }

  async listBoards(userId: string): Promise<CareerBoardSummary[]> {
    await this.ensureDefaultBoard(userId);
    return [...this.boards.values()]
      .filter((board) => board.userId === userId)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt))
      .map((board) => this.cloneBoardSummary(board));
  }

  async getBoard(userId: string, id: string): Promise<CareerBoard | null> {
    await this.ensureDefaultBoard(userId);
    const board = this.boards.get(id);
    if (!board || board.userId !== userId) return null;
    return this.cloneBoard(board);
  }

  async createBoard(userId: string, input: BoardCreateInput): Promise<CareerBoard> {
    await this.ensureDefaultBoard(userId);
    if (input.isDefault) {
      for (const board of this.boards.values()) {
        if (board.userId === userId) board.isDefault = false;
      }
    }
    const now = new Date().toISOString();
    const board: CareerBoard & { userId: string } = {
      id: nanoid(),
      userId,
      name: input.name,
      description: input.description,
      viewport: null,
      graph: input.graph ?? { nodes: [], edges: [] },
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now
    };
    this.boards.set(board.id, board);
    return this.cloneBoard(board);
  }

  async updateBoard(userId: string, id: string, input: BoardUpdateInput): Promise<CareerBoard | null> {
    const existing = this.boards.get(id);
    if (!existing || existing.userId !== userId) return null;
    if (input.isDefault) {
      for (const board of this.boards.values()) {
        if (board.userId === userId) board.isDefault = false;
      }
    }
    const updated: CareerBoard & { userId: string } = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      viewport: input.viewport === undefined ? existing.viewport : input.viewport,
      graph: input.graph ?? existing.graph,
      isDefault: input.isDefault ?? existing.isDefault,
      updatedAt: new Date().toISOString()
    };
    this.boards.set(id, updated);
    return this.cloneBoard(updated);
  }

  async deleteBoard(userId: string, id: string): Promise<boolean> {
    const existing = this.boards.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.boards.delete(id);
  }

  async duplicateBoard(userId: string, id: string): Promise<CareerBoard | null> {
    const existing = this.boards.get(id);
    if (!existing || existing.userId !== userId) return null;
    return this.createBoard(userId, {
      name: `${existing.name} kopi`,
      description: existing.description,
      graph: structuredClone(existing.graph),
      isDefault: false
    });
  }

  private cloneBoard(board: CareerBoard): CareerBoard {
    return {
      ...board,
      viewport: board.viewport ? { ...board.viewport } : null,
      graph: structuredClone(board.graph)
    };
  }

  private cloneBoardSummary(board: CareerBoard): CareerBoardSummary {
    return {
      id: board.id,
      name: board.name,
      description: board.description,
      isDefault: board.isDefault,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt
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
