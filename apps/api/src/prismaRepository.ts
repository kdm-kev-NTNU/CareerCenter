import { PrismaClient } from "@prisma/client";
import type { CareerPath, CareerPathStep, Company, CoursePlan } from "@careercenter/shared";
import type { CompanyQuery, CourseInput, PathInput, RegisterUserInput, Repository, StoredUser } from "./repository";

export class PrismaRepository implements Repository {
  constructor(private prisma = new PrismaClient()) {}

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async createUser(input: RegisterUserInput) {
    return this.prisma.user.create({
      data: { email: input.email.toLowerCase(), passwordHash: input.passwordHash },
      select: { id: true, email: true }
    });
  }

  async listCourses(userId: string): Promise<CoursePlan[]> {
    const rows = await this.prisma.coursePlan.findMany({ where: { userId }, orderBy: [{ semester: "asc" }, { sortOrder: "asc" }] });
    return rows.map(this.mapCourse);
  }

  async createCourse(userId: string, input: CourseInput): Promise<CoursePlan> {
    return this.mapCourse(await this.prisma.coursePlan.create({ data: { userId, ...input } }));
  }

  async updateCourse(userId: string, id: string, input: CourseInput): Promise<CoursePlan | null> {
    const existing = await this.prisma.coursePlan.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return this.mapCourse(await this.prisma.coursePlan.update({ where: { id }, data: input }));
  }

  async deleteCourse(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.coursePlan.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listCompanies(query: CompanyQuery): Promise<Company[]> {
    const rows = await this.prisma.company.findMany({ orderBy: { relevanceScore: "desc" } });
    const search = query.q?.toLowerCase().trim();
    return rows
      .map(this.mapCompany)
      .filter((company) => !search || [company.name, company.description, company.geography, ...company.roleTypes].join(" ").toLowerCase().includes(search))
      .filter((company) => !query.track || company.tracks.includes(query.track))
      .filter((company) => !query.tier || company.tier === query.tier)
      .filter((company) => !query.geography || company.geography.toLowerCase().includes(query.geography.toLowerCase()));
  }

  async listPaths(userId: string): Promise<CareerPath[]> {
    const rows = await this.prisma.careerPath.findMany({
      where: { userId },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map(this.mapPath);
  }

  async getPath(userId: string, id: string): Promise<CareerPath | null> {
    const row = await this.prisma.careerPath.findFirst({
      where: { id, userId },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } }
    });
    return row ? this.mapPath(row) : null;
  }

  async createPath(userId: string, input: PathInput): Promise<CareerPath> {
    const row = await this.prisma.careerPath.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        targetRole: input.targetRole,
        horizon: input.horizon,
        steps: { create: input.steps }
      },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } }
    });
    return this.mapPath(row);
  }

  async updatePath(userId: string, id: string, input: PathInput): Promise<CareerPath | null> {
    const existing = await this.prisma.careerPath.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.careerPathStep.deleteMany({ where: { pathId: id } });
      return tx.careerPath.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          targetRole: input.targetRole,
          horizon: input.horizon,
          steps: { create: input.steps }
        },
        include: { steps: { include: { company: true }, orderBy: { order: "asc" } } }
      });
    });
    return this.mapPath(row);
  }

  async deletePath(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.careerPath.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  private mapCourse(row: any): CoursePlan {
    return { ...row, semester: row.semester, status: row.status, trackTags: row.trackTags };
  }

  private mapCompany(row: any): Company {
    return { ...row, tracks: row.tracks, roleTypes: row.roleTypes };
  }

  private mapPath(row: any): CareerPath {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      targetRole: row.targetRole,
      horizon: row.horizon,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      steps: row.steps.map((step: any): CareerPathStep => ({
        id: step.id,
        companyId: step.companyId,
        order: step.order,
        note: step.note,
        targetRole: step.targetRole,
        company: step.company ? this.mapCompany(step.company) : undefined
      }))
    };
  }
}

