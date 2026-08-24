import { InvalidReferenceError } from "./repository.js";

export interface ListingCatalogSettings {
  statuses: Array<{ id: string; kind?: "stage" | "outcome" }>;
  locations: Array<{ id: string }>;
  requirementTypes: Array<{ id: string }>;
}

export interface ListingRequirementInput {
  requirementTypeId: string;
  isRequired: boolean;
  isDone: boolean;
  notes: string;
}

export interface ListingInputBase {
  statusId: string;
  locationIds: string[];
  requirements: ListingRequirementInput[];
  stageIds?: string[];
}

export async function validateListingInput<T extends ListingInputBase>(
  input: T,
  settings: ListingCatalogSettings
): Promise<T> {
  const statusesById = new Map(settings.statuses.map((item) => [item.id, item]));
  const currentStatus = statusesById.get(input.statusId);
  if (!currentStatus) {
    throw new InvalidReferenceError("Ugyldig status.");
  }

  const locationIds = new Set(settings.locations.map((item) => item.id));
  const invalidLocation = input.locationIds.find((id) => !locationIds.has(id));
  if (invalidLocation) {
    throw new InvalidReferenceError("Ugyldig sted.");
  }

  const requirementTypeIds = new Set(settings.requirementTypes.map((item) => item.id));
  const invalidRequirement = input.requirements.find((item) => !requirementTypeIds.has(item.requirementTypeId));
  if (invalidRequirement) {
    throw new InvalidReferenceError("Ugyldig kravtype.");
  }

  if (input.stageIds) {
    if (input.stageIds.length === 0) {
      throw new InvalidReferenceError("Søknadsflyt må ha minst ett steg.");
    }

    if (new Set(input.stageIds).size !== input.stageIds.length) {
      throw new InvalidReferenceError("Duplikat i søknadsflyt.");
    }

    for (const stageId of input.stageIds) {
      const stage = statusesById.get(stageId);
      if (!stage) {
        throw new InvalidReferenceError("Ugyldig steg i flyt.");
      }
      if (stage.kind === "outcome") {
        throw new InvalidReferenceError("Utfall kan ikke inngå i søknadsflyten.");
      }
    }

    if (currentStatus.kind !== "outcome" && !input.stageIds.includes(input.statusId)) {
      throw new InvalidReferenceError("Statusen må inngå i søknadsflyten.");
    }
  }

  return input;
}
