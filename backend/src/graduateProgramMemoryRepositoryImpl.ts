import { nanoid } from "nanoid";
import type {
  GraduateProgram,
  GraduateProgramLocationOption,
  GraduateProgramRequirementType,
  GraduateProgramSettings,
  GraduateProgramStatusOption
} from "@careercenter/shared";
import { createDefaultGraduateProgramCatalog } from "./graduateProgramCatalogMemory.js";
import type {
  CatalogLabelInput,
  GraduateProgramInput,
  GraduateProgramQuery,
  GraduateProgramRequirementItemInput
} from "./repository.js";
import { validateListingInput } from "./listingValidation.js";
import { CatalogInUseError } from "./repository.js";

export type MemoryGraduateProgramRepositoryDeps = {
  companyExists?: (companyId: string) => boolean;
};

type StoredGraduateProgram = GraduateProgram & { userId: string };

export function createMemoryGraduateProgramRepository(deps: MemoryGraduateProgramRepositoryDeps = {}) {
  let catalogSeeded = false;
  const statuses = new Map<string, GraduateProgramStatusOption & { userId: string }>();
  const locations = new Map<string, GraduateProgramLocationOption & { userId: string }>();
  const requirementTypes = new Map<string, GraduateProgramRequirementType & { userId: string }>();
  const graduatePrograms = new Map<string, StoredGraduateProgram>();

  function ensureCatalog(userId: string) {
    if (catalogSeeded) return;
    const defaults = createDefaultGraduateProgramCatalog();
    for (const status of defaults.statuses) statuses.set(status.id, { ...status, userId });
    for (const location of defaults.locations) locations.set(location.id, { ...location, userId });
    for (const type of defaults.requirementTypes) requirementTypes.set(type.id, { ...type, userId });
    catalogSeeded = true;
  }

  function getSettings(userId: string): GraduateProgramSettings {
    ensureCatalog(userId);
    return {
      statuses: [...statuses.values()].filter((item) => item.userId === userId).sort((a, b) => a.sortOrder - b.sortOrder),
      locations: [...locations.values()].filter((item) => item.userId === userId).sort((a, b) => a.sortOrder - b.sortOrder),
      requirementTypes: [...requirementTypes.values()]
        .filter((item) => item.userId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }

  function buildRequirements(input: GraduateProgramRequirementItemInput[], allTypes: GraduateProgramRequirementType[]) {
    if (input.length > 0) return input;
    return allTypes.map((type) => ({
      requirementTypeId: type.id,
      isRequired: true,
      isDone: false,
      notes: ""
    }));
  }

  function hydrateGraduateProgram(entry: StoredGraduateProgram, settings: GraduateProgramSettings): GraduateProgram {
    const { userId: _userId, ...rest } = entry;
    return {
      ...rest,
      status: settings.statuses.find((status) => status.id === entry.statusId),
      locations: settings.locations.filter((location) => entry.locationIds.includes(location.id)),
      requirements: entry.requirements.map((item) => {
        const type = settings.requirementTypes.find((candidate) => candidate.id === item.requirementTypeId);
        return {
          ...item,
          label: type?.label,
          description: type?.description
        };
      })
    };
  }

  function toGraduateProgram(id: string, userId: string, input: GraduateProgramInput, settings: GraduateProgramSettings): StoredGraduateProgram {
    const now = new Date().toISOString();
    const requirements = buildRequirements(input.requirements, settings.requirementTypes).map((item) => ({
      id: nanoid(),
      ...item
    }));
    return {
      id,
      userId,
      companyId: input.companyId ?? undefined,
      companyName: input.companyName,
      title: input.title,
      description: input.description,
      applicationUrl: input.applicationUrl,
      notes: input.notes,
      deadline: input.deadline?.toISOString(),
      statusId: input.statusId,
      locationIds: input.locationIds,
      trackTags: input.trackTags,
      requirements,
      createdAt: now,
      updatedAt: now
    };
  }

  return {
    getGraduateProgramSettings(userId: string) {
      return Promise.resolve(getSettings(userId));
    },

    createGraduateProgramStatus(userId: string, input: CatalogLabelInput) {
      ensureCatalog(userId);
      const settings = getSettings(userId);
      const status = { id: nanoid(), userId, label: input.label, sortOrder: input.sortOrder ?? settings.statuses.length };
      statuses.set(status.id, status);
      return Promise.resolve(status);
    },

    updateGraduateProgramStatus(userId: string, id: string, input: CatalogLabelInput) {
      const existing = statuses.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(null);
      const next = { ...existing, label: input.label, sortOrder: input.sortOrder ?? existing.sortOrder };
      statuses.set(id, next);
      return Promise.resolve(next);
    },

    deleteGraduateProgramStatus(userId: string, id: string) {
      const count = [...graduatePrograms.values()].filter((item) => item.userId === userId && item.statusId === id).length;
      if (count > 0) throw new CatalogInUseError(`Statusen er i bruk på ${count} graduate-program.`);
      return Promise.resolve(statuses.delete(id));
    },

    createGraduateProgramLocation(userId: string, input: CatalogLabelInput) {
      ensureCatalog(userId);
      const settings = getSettings(userId);
      const location = { id: nanoid(), userId, label: input.label, sortOrder: input.sortOrder ?? settings.locations.length };
      locations.set(location.id, location);
      return Promise.resolve(location);
    },

    updateGraduateProgramLocation(userId: string, id: string, input: CatalogLabelInput) {
      const existing = locations.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(null);
      const next = { ...existing, label: input.label, sortOrder: input.sortOrder ?? existing.sortOrder };
      locations.set(id, next);
      return Promise.resolve(next);
    },

    deleteGraduateProgramLocation(userId: string, id: string) {
      const count = [...graduatePrograms.values()].filter((item) => item.userId === userId && item.locationIds.includes(id)).length;
      if (count > 0) throw new CatalogInUseError(`Stedet er i bruk på ${count} graduate-program.`);
      return Promise.resolve(locations.delete(id));
    },

    createGraduateProgramRequirementType(userId: string, input: CatalogLabelInput) {
      ensureCatalog(userId);
      const settings = getSettings(userId);
      const type = {
        id: nanoid(),
        userId,
        label: input.label,
        description: input.description ?? "",
        sortOrder: input.sortOrder ?? settings.requirementTypes.length
      };
      requirementTypes.set(type.id, type);
      return Promise.resolve(type);
    },

    updateGraduateProgramRequirementType(userId: string, id: string, input: CatalogLabelInput) {
      const existing = requirementTypes.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(null);
      const next = {
        ...existing,
        label: input.label,
        description: input.description ?? existing.description,
        sortOrder: input.sortOrder ?? existing.sortOrder
      };
      requirementTypes.set(id, next);
      return Promise.resolve(next);
    },

    deleteGraduateProgramRequirementType(userId: string, id: string) {
      const count = [...graduatePrograms.values()].flatMap((item) => item.requirements).filter((item) => item.requirementTypeId === id).length;
      if (count > 0) throw new CatalogInUseError(`Kravtypen er i bruk på ${count} graduate-program.`);
      return Promise.resolve(requirementTypes.delete(id));
    },

    listGraduatePrograms(userId: string, query: GraduateProgramQuery) {
      const settings = getSettings(userId);
      const search = query.q?.toLowerCase().trim();
      const rows = [...graduatePrograms.values()]
        .filter((item) => item.userId === userId)
        .filter((item) => !search || [item.companyName, item.title, item.description, item.notes].join(" ").toLowerCase().includes(search))
        .filter((item) => !query.statusId || item.statusId === query.statusId)
        .filter((item) => !query.locationId || item.locationIds.includes(query.locationId))
        .filter((item) => !query.track || item.trackTags.includes(query.track))
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "") || b.updatedAt.localeCompare(a.updatedAt));
      return Promise.resolve(rows.map((row) => hydrateGraduateProgram(row, settings)));
    },

    async createGraduateProgram(userId: string, input: GraduateProgramInput) {
      const settings = getSettings(userId);
      const validated = await validateListingInput(input, settings, {
        companyExists: deps.companyExists
          ? async (companyId) => deps.companyExists!(companyId)
          : undefined
      });
      const entry = toGraduateProgram(nanoid(), userId, validated, settings);
      graduatePrograms.set(entry.id, entry);
      return hydrateGraduateProgram(entry, settings);
    },

    async updateGraduateProgram(userId: string, id: string, input: GraduateProgramInput) {
      const existing = graduatePrograms.get(id);
      if (!existing || existing.userId !== userId) return null;
      const settings = getSettings(userId);
      const validated = await validateListingInput(input, settings, {
        companyExists: deps.companyExists
          ? async (companyId) => deps.companyExists!(companyId)
          : undefined
      });
      const entry: StoredGraduateProgram = {
        ...toGraduateProgram(id, userId, validated, settings),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };
      graduatePrograms.set(id, entry);
      return hydrateGraduateProgram(entry, settings);
    },

    deleteGraduateProgram(userId: string, id: string) {
      const existing = graduatePrograms.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(false);
      return Promise.resolve(graduatePrograms.delete(id));
    }
  };
}
