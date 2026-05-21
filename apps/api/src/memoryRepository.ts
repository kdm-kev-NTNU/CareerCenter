import { nanoid } from "nanoid";
import type { CareerPath, CareerPathStep, Company, CoursePlan, UserProfile } from "@careercenter/shared";
import { companies as seededCompanies } from "./seedData";
import type { CompanyQuery, CourseInput, PathInput, RegisterUserInput, Repository, StoredUser } from "./repository";

export class MemoryRepository implements Repository {
  private users = new Map<string, StoredUser>();
  private courses = new Map<string, CoursePlan & { userId: string }>();
  private paths = new Map<string, CareerPath & { userId: string }>();
  private companies = [...seededCompanies];

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async createUser(input: RegisterUserInput): Promise<UserProfile> {
    const user = { id: nanoid(), email: input.email.toLowerCase(), passwordHash: input.passwordHash };
    this.users.set(user.id, user);
    return { id: user.id, email: user.email };
  }

  async listCourses(userId: string): Promise<CoursePlan[]> {
    return [...this.courses.values()].filter((course) => course.userId === userId).sort((a, b) => a.semester - b.semester || a.sortOrder - b.sortOrder);
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
      steps: path.steps.map((step) => ({ ...step, company: this.companies.find((company) => company.id === step.companyId) })).sort((a, b) => a.order - b.order)
    };
  }
}

