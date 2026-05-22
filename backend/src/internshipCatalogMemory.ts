import { nanoid } from "nanoid";
import type {
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipStatusOption
} from "@careercenter/shared";
import {
  defaultInternshipLocations,
  defaultInternshipRequirementTypes,
  defaultInternshipStatuses
} from "./internshipSeedData.js";

export function createDefaultInternshipCatalog(): {
  statuses: InternshipStatusOption[];
  locations: InternshipLocationOption[];
  requirementTypes: InternshipRequirementType[];
} {
  return {
    statuses: defaultInternshipStatuses.map((label, sortOrder) => ({ id: nanoid(), label, sortOrder })),
    locations: defaultInternshipLocations.map((label, sortOrder) => ({ id: nanoid(), label, sortOrder })),
    requirementTypes: defaultInternshipRequirementTypes.map((item, sortOrder) => ({
      id: nanoid(),
      label: item.label,
      description: item.description,
      sortOrder
    }))
  };
}
