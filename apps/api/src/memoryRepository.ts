import { nanoid } from "nanoid";
import type { CareerMapNode, CareerPath, CareerPathStep, CareerTrack, CareerTrackSetting, Company, CoursePlan, UserProfile } from "@careercenter/shared";
import { companies as seededCompanies, careerMapNodeSeeds, careerTrackSeeds } from "./seedData.js";
import type { CareerMapNodeInput, CareerTrackInput, CompanyQuery, CourseInput, PathInput, Repository } from "./repository.js";
import { SINGLE_USER_EMAIL } from "./repository.js";

type StoredTrack = CareerTrackSetting & { defaultLabel: string };
type StoredNode = CareerMapNode & { defaultTitle: string; defaultItems: string[]; sortOrder: number };

export class MemoryRepository implements Repository {
  private singleUser: UserProfile | null = null;
  private courses = new Map<string, CoursePlan & { userId: string }>();
  private paths = new Map<string, CareerPath & { userId: string }>();
  private companies = [...seededCompanies];
  private tracks = new Map<string, StoredTrack>(careerTrackSeeds.map((track) => [track.id, { ...track, defaultLabel: track.label }]));
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

  async getOrCreateSingleUser(): Promise<UserProfile> {
    this.singleUser ??= { id: "single-user", email: SINGLE_USER_EMAIL };
    return this.singleUser;
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

  async listPaths(userId: string): Promise<CareerPath[]> {
    return [...this.paths.values()].filter((path) => path.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getPath(userId: string, id: string): Promise<CareerPath | null> {
    const path = this.paths.get(id);
    return path?.userId === userId ? this.hydratePath(path) : null;
  }

  async createPath(userId: string, input: PathInput): Promise<CareerPath> {
    const now = new Date().toISOString();
    const path: CareerPath & { userId: string } = { id: nanoid(), userId, ...input, steps: this.createSteps(input.steps), createdAt: now, updatedAt: now };
    this.paths.set(path.id, path);
    return this.hydratePath(path);
  }

  async updatePath(userId: string, id: string, input: PathInput): Promise<CareerPath | null> {
    const existing = this.paths.get(id);
    if (!existing || existing.userId !== userId) return null;
    const path: CareerPath & { userId: string } = { ...existing, ...input, steps: this.createSteps(input.steps), updatedAt: new Date().toISOString() };
    this.paths.set(id, path);
    return this.hydratePath(path);
  }

  async deletePath(userId: string, id: string): Promise<boolean> {
    const existing = this.paths.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.paths.delete(id);
  }

  private createSteps(steps: PathInput["steps"]): CareerPathStep[] {
    return steps.map((step) => ({ ...step, id: nanoid() })).sort((a, b) => a.order - b.order);
  }

  private hydratePath(path: CareerPath): CareerPath {
    return {
      ...path,
      steps: path.steps
        .map((step) => ({ ...step, company: this.companies.find((company) => company.id === step.companyId) }))
        .sort((a, b) => a.order - b.order)
    };
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
}
