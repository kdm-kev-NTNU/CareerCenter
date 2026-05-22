import { nanoid } from "nanoid";
import type {
  GraduateProgramLocationOption,
  GraduateProgramRequirementType,
  GraduateProgramStatusOption
} from "@careercenter/shared";
import {
  defaultGraduateProgramLocations,
  defaultGraduateProgramRequirementTypes,
  defaultGraduateProgramStatuses
} from "./graduateProgramSeedData.js";

export function createDefaultGraduateProgramCatalog(): {
  statuses: GraduateProgramStatusOption[];
  locations: GraduateProgramLocationOption[];
  requirementTypes: GraduateProgramRequirementType[];
} {
  return {
    statuses: defaultGraduateProgramStatuses.map((label, sortOrder) => ({ id: nanoid(), label, sortOrder })),
    locations: defaultGraduateProgramLocations.map((label, sortOrder) => ({ id: nanoid(), label, sortOrder })),
    requirementTypes: defaultGraduateProgramRequirementTypes.map((item, sortOrder) => ({
      id: nanoid(),
      label: item.label,
      description: item.description,
      sortOrder
    }))
  };
}
