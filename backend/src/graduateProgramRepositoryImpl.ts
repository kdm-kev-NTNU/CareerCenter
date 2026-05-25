import type { PrismaClient } from "@prisma/client";
import type {
  GraduateProgram,
  GraduateProgramLocationOption,
  GraduateProgramRequirementType,
  GraduateProgramSettings
} from "@careercenter/shared";
import { ensureGraduateProgramCatalog } from "./graduateProgramCatalog.js";
import type {
  CatalogLabelInput,
  GraduateProgramInput,
  GraduateProgramQuery,
  GraduateProgramRequirementItemInput
} from "./repository.js";
import { validateListingInput } from "./listingValidation.js";
import { CatalogInUseError } from "./repository.js";

const graduateProgramInclude = {
  status: true,
  requirements: { include: { requirementType: true } }
} as const;

type GraduateProgramRow = {
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

export function createPrismaGraduateProgramRepository(prisma: PrismaClient) {
  async function loadSettings(userId: string): Promise<GraduateProgramSettings> {
    await ensureGraduateProgramCatalog(prisma, userId);
    const [statuses, locations, requirementTypes] = await Promise.all([
      prisma.graduateProgramStatusOption.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.graduateProgramLocationOption.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
      prisma.graduateProgramRequirementType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } })
    ]);
    return { statuses, locations, requirementTypes };
  }

  function mapGraduateProgram(row: GraduateProgramRow, locations: GraduateProgramLocationOption[]): GraduateProgram {
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
      trackTags: row.trackTags as GraduateProgram["trackTags"],
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

  async function hydrateGraduatePrograms(userId: string, rows: GraduateProgramRow[]): Promise<GraduateProgram[]> {
    const settings = await loadSettings(userId);
    return rows.map((row) => mapGraduateProgram(row, settings.locations));
  }

  function buildRequirements(
    input: GraduateProgramRequirementItemInput[],
    allTypes: GraduateProgramRequirementType[]
  ): GraduateProgramRequirementItemInput[] {
    if (input.length > 0) return input;
    return allTypes.map((type) => ({
      requirementTypeId: type.id,
      isRequired: true,
      isDone: false,
      notes: ""
    }));
  }

  return {
    async getGraduateProgramSettings(userId: string) {
      return loadSettings(userId);
    },

    async createGraduateProgramStatus(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.statuses.length;
      return prisma.graduateProgramStatusOption.create({ data: { userId, label: input.label, sortOrder } });
    },

    async updateGraduateProgramStatus(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.graduateProgramStatusOption.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.graduateProgramStatusOption.update({
        where: { id },
        data: { label: input.label, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) }
      });
    },

    async deleteGraduateProgramStatus(userId: string, id: string) {
      const count = await prisma.graduateProgram.count({ where: { userId, statusId: id } });
      if (count > 0) throw new CatalogInUseError(`Statusen er i bruk på ${count} graduate-program.`);
      const result = await prisma.graduateProgramStatusOption.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async createGraduateProgramLocation(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.locations.length;
      return prisma.graduateProgramLocationOption.create({ data: { userId, label: input.label, sortOrder } });
    },

    async updateGraduateProgramLocation(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.graduateProgramLocationOption.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.graduateProgramLocationOption.update({
        where: { id },
        data: { label: input.label, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}) }
      });
    },

    async deleteGraduateProgramLocation(userId: string, id: string) {
      const programs = await prisma.graduateProgram.findMany({ where: { userId }, select: { locationIds: true } });
      const count = programs.filter((item) => item.locationIds.includes(id)).length;
      if (count > 0) throw new CatalogInUseError(`Stedet er i bruk på ${count} graduate-program.`);
      const result = await prisma.graduateProgramLocationOption.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async createGraduateProgramRequirementType(userId: string, input: CatalogLabelInput) {
      const settings = await loadSettings(userId);
      const sortOrder = input.sortOrder ?? settings.requirementTypes.length;
      return prisma.graduateProgramRequirementType.create({
        data: { userId, label: input.label, description: input.description ?? "", sortOrder }
      });
    },

    async updateGraduateProgramRequirementType(userId: string, id: string, input: CatalogLabelInput) {
      const existing = await prisma.graduateProgramRequirementType.findFirst({ where: { id, userId } });
      if (!existing) return null;
      return prisma.graduateProgramRequirementType.update({
        where: { id },
        data: {
          label: input.label,
          description: input.description ?? existing.description,
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {})
        }
      });
    },

    async deleteGraduateProgramRequirementType(userId: string, id: string) {
      const count = await prisma.graduateProgramRequirementItem.count({ where: { requirementTypeId: id } });
      if (count > 0) throw new CatalogInUseError(`Kravtypen er i bruk på ${count} graduate-program.`);
      const result = await prisma.graduateProgramRequirementType.deleteMany({ where: { id, userId } });
      return result.count > 0;
    },

    async listGraduatePrograms(userId: string, query: GraduateProgramQuery) {
      const rows = (await prisma.graduateProgram.findMany({
        where: { userId },
        include: graduateProgramInclude,
        orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }]
      })) as GraduateProgramRow[];
      const search = query.q?.toLowerCase().trim();
      const filtered = rows
        .filter((row) => !search || [row.companyName, row.title, row.description, row.notes].join(" ").toLowerCase().includes(search))
        .filter((row) => !query.statusId || row.statusId === query.statusId)
        .filter((row) => !query.locationId || row.locationIds.includes(query.locationId))
        .filter((row) => !query.track || (row.trackTags as string[]).includes(query.track));
      return hydrateGraduatePrograms(userId, filtered);
    },

    async createGraduateProgram(userId: string, input: GraduateProgramInput) {
      const settings = await loadSettings(userId);
      const validated = await validateListingInput(input, settings, {
        companyExists: async (companyId) => {
          const company = await prisma.company.findFirst({ where: { id: companyId } });
          return company !== null;
        }
      });
      const requirements = buildRequirements(validated.requirements, settings.requirementTypes);
      const row = (await prisma.graduateProgram.create({
        data: {
          userId,
          companyId: validated.companyId ?? null,
          companyName: validated.companyName,
          title: validated.title,
          description: validated.description,
          applicationUrl: validated.applicationUrl,
          notes: validated.notes,
          deadline: validated.deadline ?? null,
          statusId: validated.statusId,
          locationIds: validated.locationIds,
          trackTags: validated.trackTags,
          requirements: { create: requirements }
        },
        include: graduateProgramInclude
      })) as GraduateProgramRow;
      return mapGraduateProgram(row, settings.locations);
    },

    async updateGraduateProgram(userId: string, id: string, input: GraduateProgramInput) {
      const existing = await prisma.graduateProgram.findFirst({ where: { id, userId } });
      if (!existing) return null;
      const settings = await loadSettings(userId);
      const validated = await validateListingInput(input, settings, {
        companyExists: async (companyId) => {
          const company = await prisma.company.findFirst({ where: { id: companyId } });
          return company !== null;
        }
      });
      const requirements = buildRequirements(validated.requirements, settings.requirementTypes);
      const row = (await prisma.$transaction(async (tx) => {
        await tx.graduateProgramRequirementItem.deleteMany({ where: { graduateProgramId: id } });
        return tx.graduateProgram.update({
          where: { id },
          data: {
            companyId: validated.companyId ?? null,
            companyName: validated.companyName,
            title: validated.title,
            description: validated.description,
            applicationUrl: validated.applicationUrl,
            notes: validated.notes,
            deadline: validated.deadline ?? null,
            statusId: validated.statusId,
            locationIds: validated.locationIds,
            trackTags: validated.trackTags,
            requirements: { create: requirements }
          },
          include: graduateProgramInclude
        });
      })) as GraduateProgramRow;
      return mapGraduateProgram(row, settings.locations);
    },

    async deleteGraduateProgram(userId: string, id: string) {
      const result = await prisma.graduateProgram.deleteMany({ where: { id, userId } });
      return result.count > 0;
    }
  };
}
