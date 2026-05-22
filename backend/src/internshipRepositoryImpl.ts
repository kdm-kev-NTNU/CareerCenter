import type { PrismaClient } from "@prisma/client";
import type {
  Internship,
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipSettings
} from "@careercenter/shared";
import { ensureInternshipCatalog } from "./internshipCatalog.js";
import type {
  CatalogLabelInput,
  InternshipInput,
  InternshipQuery,
  InternshipRequirementItemInput
} from "./repository.js";
import { CatalogInUseError } from "./repository.js";

const internshipInclude = {
  status: true,
  requirements: { include: { requirementType: true } }
} as const;

type InternshipRow = {
  id: string;
  userId: string;
  companyId: string | null;
  companyName: string;
  title: string;
  description: string;
  applicationUrl: string;
  notes: string;
  deadline: Date | null;
  statusId: string;
  locationIds: string[];
  trackTags: string[];
  createdAt: Date;
  updatedAt: Date;
  status: { id: string; label: string; sortOrder: number };
  requirements: Array<{
    id: string;
    requirementTypeId: string;
    isRequired: boolean;
    isDone: boolean;
    notes: string;
    requirementType: { id: string; label: string; description: string; sortOrder: number };
  }>;
};

export function createPrismaInternshipRepository(prisma: PrismaClient) {
  async function loadSettings(userId: string): Promise<InternshipSettings> {
    await ensureInternshipCatalog(prisma, userId);
    const [statuses, locations, requirementTypes] = await Promise.all([
      prisma.internshipStatusOption.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.internshipLocationOption.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.internshipRequirementType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } })
    ]);
    return { statuses, locations, requirementTypes };
  }

  function mapInternship(row: InternshipRow, locations: InternshipLocationOption[]): Internship {
    return {
      id: row.id,
      companyId: row.companyId ?? undefined,
      companyName: row.companyName,
      title: row.title,
      description: row.description,
      applicationUrl: row.applicationUrl,
      notes: row.notes,
      deadline: row.deadline?.toISOString(),
      statusId: row.statusId,
      status: row.status,
      locationIds: row.locationIds,
      locations: locations.filter((location) => row.locationIds.includes(location.id)),
      trackTags: row.trackTags as Internship["trackTags"],
      requirements: row.requirements.map((item) => ({
        id: item.id,
        requirementTypeId: item.requirementTypeId,
        label: item.requirementType.label,
        description: item.requirementType.description,
        isRequired: item.isRequired,
        isDone: item.isDone,
        notes: item.notes
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  async function hydrateInternships(userId: string, rows: InternshipRow[]): Promise<Internship[]> {
    const settings = await loadSettings(userId);
    return rows.map((row) => mapInternship(row, settings.locations));
  }

  function buildRequirements(
    input: InternshipRequirementItemInput[],
    allTypes: InternshipRequirementType[]
  ): InternshipRequirementItemInput[] {
    if (input.length > 0) return input;
    return allTypes.map((type) => ({
      requirementTypeId: type.id,
      isRequired: true,
      isDone: false,
      notes: ""
    }));
  }

  return {
    async getInternshipSettings(userId: string) {
      return loadSettings(userId);
    },

    async createInternshipStatus(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.statuses.length;
      return prisma.internshipStatusOption.create({ data: { userId, label: input.label, sortOrder } });
    },

    async updateInternshipStatus(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.internshipStatusOption.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.internshipStatusOption.update({
        where: { id },
        data: { label: input.label, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) }
      });
    },

    async deleteInternshipStatus(userId: string, id: string) {
      const count = await prisma.internship.count({ where: { userId, statusId: id } });
      if (count > 0) throw new CatalogInUseError(`Statusen er i bruk på ${count} internship.`);
      const result = await prisma.internshipStatusOption.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async createInternshipLocation(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.locations.length;
      return prisma.internshipLocationOption.create({ data: { userId, label: input.label, sortOrder } });
    },

    async updateInternshipLocation(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.internshipLocationOption.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.internshipLocationOption.update({
        where: { id },
        data: { label: input.label, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) }
      });
    },

    async deleteInternshipLocation(userId: string, id: string) {
      const internships = await prisma.internship.findMany({ where: { userId }, select: { locationIds: true } });
      const count = internships.filter((item) => item.locationIds.includes(id)).length;
      if (count > 0) throw new CatalogInUseError(`Stedet er i bruk på ${count} internship.`);
      const result = await prisma.internshipLocationOption.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async createInternshipRequirementType(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.requirementTypes.length;
      return prisma.internshipRequirementType.create({
        data: { userId, label: input.label, description: input.description ?? "", sortOrder }
      });
    },

    async updateInternshipRequirementType(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.internshipRequirementType.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.internshipRequirementType.update({
        where: { id },
        data: {
          label: input.label,
          description: input.description ?? existing.description,
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
        }
      });
    },

    async deleteInternshipRequirementType(userId: string, id: string) {
      const count = await prisma.internshipRequirementItem.count({ where: { requirementTypeId: id } });
      if (count > 0) throw new CatalogInUseError(`Kravtypen er i bruk på ${count} internship.`);
      const result = await prisma.internshipRequirementType.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async listInternships(userId: string, query: InternshipQuery) {
      const rows = (await prisma.internship.findMany({
        where: { userId },
        include: internshipInclude,
        orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }]
      })) as InternshipRow[];
      const search = query.q?.toLowerCase().trim();
      const filtered = rows
        .filter((row) => !search || [row.companyName, row.title, row.description, row.notes].join(" ").toLowerCase().includes(search))
        .filter((row) => !query.statusId || row.statusId === query.statusId)
        .filter((row) => !query.locationId || row.locationIds.includes(query.locationId))
        .filter((row) => !query.track || (row.trackTags as string[]).includes(query.track));
      return hydrateInternships(userId, filtered);
    },

    async createInternship(userId: string, input: InternshipInput) {
      const settings = await loadSettings(userId);
      const requirements = buildRequirements(input.requirements, settings.requirementTypes);
      const row = (await prisma.internship.create({
        data: {
          userId,
          companyId: input.companyId ?? null,
          companyName: input.companyName,
          title: input.title,
          description: input.description,
          applicationUrl: input.applicationUrl,
          notes: input.notes,
          deadline: input.deadline ?? null,
          statusId: input.statusId,
          locationIds: input.locationIds,
          trackTags: input.trackTags,
          requirements: { create: requirements }
        },
        include: internshipInclude
      })) as InternshipRow;
      return mapInternship(row, settings.locations);
    },

    async updateInternship(userId: string, id: string, input: InternshipInput) {
      const existing = await prisma.internship.findFirst({ where: { id, userId } });
      if (!existing) return null;
      const settings = await loadSettings(userId);
      const requirements = buildRequirements(input.requirements, settings.requirementTypes);
      const row = (await prisma.$transaction(async (tx) => {
        await tx.internshipRequirementItem.deleteMany({ where: { internshipId: id } });
        return tx.internship.update({
          where: { id },
          data: {
            companyId: input.companyId ?? null,
            companyName: input.companyName,
            title: input.title,
            description: input.description,
            applicationUrl: input.applicationUrl,
            notes: input.notes,
            deadline: input.deadline ?? null,
            statusId: input.statusId,
            locationIds: input.locationIds,
            trackTags: input.trackTags,
            requirements: { create: requirements }
          },
          include: internshipInclude
        });
      })) as InternshipRow;
      return mapInternship(row, settings.locations);
    },

    async deleteInternship(userId: string, id: string) {
      const result = await prisma.internship.deleteMany({ where: { id, userId } });
      return result.count > 0;
    }
  };
}
