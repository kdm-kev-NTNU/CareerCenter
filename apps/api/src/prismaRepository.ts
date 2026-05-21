import { PrismaClient } from "@prisma/client";
import type { CareerMapNode, CareerPath, CareerPathStep, CareerTrack, CareerTrackSetting, Company, CoursePlan } from "@careercenter/shared";
import type { CareerMapNodeInput, CareerTrackInput, CompanyQuery, CourseInput, PathInput, Repository } from "./repository.js";
import { SINGLE_USER_EMAIL } from "./repository.js";

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

type CompanyRow = {
  id: string;
  name: string;
  description: string;
  tracks: string[];
  tier: number;
  geography: string;
  roleTypes: string[];
  difficulty: string;
  upside: string;
  relevanceScore: number;
  websiteUrl: string | null;
};

type PathStepRow = {
  id: string;
  companyId: string;
  order: number;
  note: string;
  targetRole: string;
  company: CompanyRow | null;
};

type PathRow = {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  horizon: string;
  createdAt: Date;
  updatedAt: Date;
  steps: PathStepRow[];
};

type MapNodeRow = {
  id: string;
  defaultTitle: string;
  title: string;
  defaultItems: string[];
  items: string[];
  level: number;
  trackId: CareerTrack | null;
  sortOrder: number;
};

type TrackRow = {
  id: CareerTrack;
  defaultLabel: string;
  label: string;
  sortOrder: number;
};

export class PrismaRepository implements Repository {
  constructor(private prisma = new PrismaClient()) {}

  async getOrCreateSingleUser() {
    return this.prisma.user.upsert({
      where: { email: SINGLE_USER_EMAIL },
      update: {},
      create: { email: SINGLE_USER_EMAIL, passwordHash: "single-user-no-login" },
      select: { id: true, email: true }
    });
  }

  async getCareerMap(): Promise<{ nodes: CareerMapNode[]; tracks: CareerTrackSetting[] }> {
    const [nodes, tracks] = await Promise.all([
      this.prisma.careerMapNode.findMany({ orderBy: [{ level: "asc" }, { sortOrder: "asc" }] }) as Promise<MapNodeRow[]>,
      this.prisma.careerTrackSetting.findMany({ orderBy: { sortOrder: "asc" } }) as Promise<TrackRow[]>
    ]);
    return { nodes: nodes.map((node) => this.mapNode(node)), tracks: tracks.map((track) => this.mapTrack(track)) };
  }

  async updateCareerMapNode(id: string, input: CareerMapNodeInput): Promise<CareerMapNode | null> {
    const existing = await this.prisma.careerMapNode.findUnique({ where: { id } });
    if (!existing) return null;
    return this.mapNode((await this.prisma.careerMapNode.update({ where: { id }, data: { title: input.title, items: input.items } })) as MapNodeRow);
  }

  async resetCareerMapNode(id: string): Promise<CareerMapNode | null> {
    const existing = await this.prisma.careerMapNode.findUnique({ where: { id } });
    if (!existing) return null;
    return this.mapNode((await this.prisma.careerMapNode.update({ where: { id }, data: { title: existing.defaultTitle, items: existing.defaultItems } })) as MapNodeRow);
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

  async listCompanies(query: CompanyQuery): Promise<Company[]> {
    const rows = (await this.prisma.company.findMany({ orderBy: { relevanceScore: "desc" } })) as CompanyRow[];
    const search = query.q?.toLowerCase().trim();
    return rows
      .map((row) => this.mapCompany(row))
      .filter((company) => !search || [company.name, company.description, company.geography, ...company.roleTypes].join(" ").toLowerCase().includes(search))
      .filter((company) => !query.track || company.tracks.includes(query.track))
      .filter((company) => !query.tier || company.tier === query.tier)
      .filter((company) => !query.geography || company.geography.toLowerCase().includes(query.geography.toLowerCase()));
  }

  async listPaths(userId: string): Promise<CareerPath[]> {
    const rows = (await this.prisma.careerPath.findMany({
      where: { userId },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" }
    })) as PathRow[];
    return rows.map((row) => this.mapPath(row));
  }

  async getPath(userId: string, id: string): Promise<CareerPath | null> {
    const row = (await this.prisma.careerPath.findFirst({
      where: { id, userId },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } }
    })) as PathRow | null;
    return row ? this.mapPath(row) : null;
  }

  async createPath(userId: string, input: PathInput): Promise<CareerPath> {
    const row = (await this.prisma.careerPath.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        targetRole: input.targetRole,
        horizon: input.horizon,
        steps: { create: input.steps }
      },
      include: { steps: { include: { company: true }, orderBy: { order: "asc" } } }
    })) as PathRow;
    return this.mapPath(row);
  }

  async updatePath(userId: string, id: string, input: PathInput): Promise<CareerPath | null> {
    const existing = await this.prisma.careerPath.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const row = (await this.prisma.$transaction(async (tx) => {
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
    })) as unknown as PathRow;
    return this.mapPath(row);
  }

  async deletePath(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.careerPath.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  private mapCourse(row: CourseRow): CoursePlan {
    return { ...row, semester: row.semester as CoursePlan["semester"], status: row.status as CoursePlan["status"], trackTags: row.trackTags as CoursePlan["trackTags"] };
  }

  private mapCompany(row: CompanyRow): Company {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      tracks: row.tracks as Company["tracks"],
      tier: row.tier as Company["tier"],
      geography: row.geography,
      roleTypes: row.roleTypes,
      difficulty: row.difficulty as Company["difficulty"],
      upside: row.upside as Company["upside"],
      relevanceScore: row.relevanceScore,
      websiteUrl: row.websiteUrl ?? undefined
    };
  }

  private mapPath(row: PathRow): CareerPath {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      targetRole: row.targetRole,
      horizon: row.horizon,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      steps: row.steps.map((step): CareerPathStep => ({
        id: step.id,
        companyId: step.companyId,
        order: step.order,
        note: step.note,
        targetRole: step.targetRole,
        company: step.company ? this.mapCompany(step.company) : undefined
      }))
    };
  }

  private mapNode(row: MapNodeRow): CareerMapNode {
    return {
      id: row.id,
      title: row.title,
      level: row.level as CareerMapNode["level"],
      track: row.trackId ?? undefined,
      items: [...row.items]
    };
  }

  private mapTrack(row: TrackRow): CareerTrackSetting {
    return {
      id: row.id,
      label: row.label,
      sortOrder: row.sortOrder
    };
  }
}
