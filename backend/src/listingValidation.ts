import { InvalidReferenceError } from "./repository.js";

export interface ListingCatalogSettings {
  statuses: Array<{ id: string }>;
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
}

export async function validateListingInput<T extends ListingInputBase>(
  input: T,
  settings: ListingCatalogSettings
): Promise<T> {
  const statusIds = new Set(settings.statuses.map((item) => item.id));
  if (!statusIds.has(input.statusId)) {
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

  return input;
}
