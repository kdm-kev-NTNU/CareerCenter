import { nanoid } from "nanoid";
import type {
  Internship,
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipSettings,
  InternshipStatusOption
} from "@careercenter/shared";
import { createDefaultInternshipCatalog } from "./internshipCatalogMemory.js";
import type {
  CatalogLabelInput,
  InternshipInput,
  InternshipQuery,
  InternshipRequirementItemInput
} from "./repository.js";
import { validateListingInput } from "./listingValidation.js";
import { CatalogInUseError } from "./repository.js";

type StoredInternship = Internship & { userId: string };

export function createMemoryInternshipRepository() {
  let catalogSeeded = false;
  const statuses = new Map<string, InternshipStatusOption & { userId: string }>();
  const locations = new Map<string, InternshipLocationOption & { userId: string }>();
  const requirementTypes = new Map<string, InternshipRequirementType & { userId: string }>();
  const internships = new Map<string, StoredInternship>();

  function ensureCatalog(userId: string) {
    if (catalogSeeded) return;
    const defaults = createDefaultInternshipCatalog();
    for (const status of defaults.statuses) statuses.set(status.id, { ...status, userId });
    for (const location of defaults.locations) locations.set(location.id, { ...location, userId });
    for (const type of defaults.requirementTypes) requirementTypes.set(type.id, { ...type, userId });
    catalogSeeded = true;
  }

  function getSettings(userId: string): InternshipSettings {
    ensureCatalog(userId);
    return {
      statuses: [...statuses.values()].filter((item) => item.userId === userId).sort((a, b) => a.sortOrder - b.sortOrder),
      locations: [...locations.values()].filter((item) => item.userId === userId).sort((a, b) => a.sortOrder - b.sortOrder),
      requirementTypes: [...requirementTypes.values()]
        .filter((item) => item.userId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    };
  }

  function buildRequirements(input: InternshipRequirementItemInput[], allTypes: InternshipRequirementType[]) {
    if (input.length > 0) return input;
    return allTypes.map((type) => ({
      requirementTypeId: type.id,
      isRequired: true,
      isDone: false,
      notes: ""
    }));
  }

  function hydrateInternship(entry: StoredInternship, settings: InternshipSettings): Internship {
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

  function toInternship(id: string, userId: string, input: InternshipInput, settings: InternshipSettings): StoredInternship {
    const now = new Date().toISOString();
    const requirements = buildRequirements(input.requirements, settings.requirementTypes).map((item) => ({
      id: nanoid(),
      ...item
    }));
    return {
      id,
      userId,
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
    getInternshipSettings(userId: string) {
      return Promise.resolve(getSettings(userId));
    },

    createInternshipStatus(userId: string, input: CatalogLabelInput) {
      ensureCatalog(userId);
      const settings = getSettings(userId);
      const status = { id: nanoid(), userId, label: input.label, sortOrder: input.sortOrder ?? settings.statuses.length };
      statuses.set(status.id, status);
      return Promise.resolve(status);
    },

    updateInternshipStatus(userId: string, id: string, input: CatalogLabelInput) {
      const existing = statuses.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(null);
      const next = { ...existing, label: input.label, sortOrder: input.sortOrder ?? existing.sortOrder };
      statuses.set(id, next);
      return Promise.resolve(next);
    },

    deleteInternshipStatus(userId: string, id: string) {
      const count = [...internships.values()].filter((item) => item.userId === userId && item.statusId === id).length;
      if (count > 0) throw new CatalogInUseError(`Statusen er i bruk på ${count} internship.`);
      return Promise.resolve(statuses.delete(id));
    },

    createInternshipLocation(userId: string, input: CatalogLabelInput) {
      ensureCatalog(userId);
      const settings = getSettings(userId);
      const location = { id: nanoid(), userId, label: input.label, sortOrder: input.sortOrder ?? settings.locations.length };
      locations.set(location.id, location);
      return Promise.resolve(location);
    },

    updateInternshipLocation(userId: string, id: string, input: CatalogLabelInput) {
      const existing = locations.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(null);
      const next = { ...existing, label: input.label, sortOrder: input.sortOrder ?? existing.sortOrder };
      locations.set(id, next);
      return Promise.resolve(next);
    },

    deleteInternshipLocation(userId: string, id: string) {
      const count = [...internships.values()].filter((item) => item.userId === userId && item.locationIds.includes(id)).length;
      if (count > 0) throw new CatalogInUseError(`Stedet er i bruk på ${count} internship.`);
      return Promise.resolve(locations.delete(id));
    },

    createInternshipRequirementType(userId: string, input: CatalogLabelInput) {
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

    updateInternshipRequirementType(userId: string, id: string, input: CatalogLabelInput) {
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

    deleteInternshipRequirementType(userId: string, id: string) {
      const count = [...internships.values()].flatMap((item) => item.requirements).filter((item) => item.requirementTypeId === id).length;
      if (count > 0) throw new CatalogInUseError(`Kravtypen er i bruk på ${count} internship.`);
      return Promise.resolve(requirementTypes.delete(id));
    },

    listInternships(userId: string, query: InternshipQuery) {
      const settings = getSettings(userId);
      const search = query.q?.toLowerCase().trim();
      const rows = [...internships.values()]
        .filter((item) => item.userId === userId)
        .filter((item) => !search || [item.companyName, item.title, item.description, item.notes].join(" ").toLowerCase().includes(search))
        .filter((item) => !query.statusId || item.statusId === query.statusId)
        .filter((item) => !query.locationId || item.locationIds.includes(query.locationId))
        .filter((item) => !query.track || item.trackTags.includes(query.track))
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? "") || b.updatedAt.localeCompare(a.updatedAt));
      return Promise.resolve(rows.map((row) => hydrateInternship(row, settings)));
    },

    async createInternship(userId: string, input: InternshipInput) {
      const settings = getSettings(userId);
      const validated = await validateListingInput(input, settings);
      const entry = toInternship(nanoid(), userId, validated, settings);
      internships.set(entry.id, entry);
      return hydrateInternship(entry, settings);
    },

    async updateInternship(userId: string, id: string, input: InternshipInput) {
      const existing = internships.get(id);
      if (!existing || existing.userId !== userId) return null;
      const settings = getSettings(userId);
      const validated = await validateListingInput(input, settings);
      const entry: StoredInternship = {
        ...toInternship(id, userId, validated, settings),
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      };
      internships.set(id, entry);
      return hydrateInternship(entry, settings);
    },

    deleteInternship(userId: string, id: string) {
      const existing = internships.get(id);
      if (!existing || existing.userId !== userId) return Promise.resolve(false);
      return Promise.resolve(internships.delete(id));
    }
  };
}
