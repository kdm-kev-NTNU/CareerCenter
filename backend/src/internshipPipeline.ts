import { isInternshipStage, type InternshipStatusOption } from "@careercenter/shared";
import { InvalidReferenceError } from "./repository.js";

export function planInternshipStatusReorder(
  statuses: InternshipStatusOption[],
  ids: string[]
): InternshipStatusOption[] {
  const stages = statuses.filter(isInternshipStage);
  const outcomes = statuses.filter((status) => status.kind === "outcome");
  const byId = new Map(stages.map((status) => [status.id, status]));

  if (ids.length !== stages.length || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
    throw new InvalidReferenceError("Ugyldig statusrekkefølge.");
  }

  return [
    ...ids.map((id, sortOrder) => ({ ...byId.get(id)!, sortOrder })),
    ...outcomes.map((status, index) => ({ ...status, sortOrder: ids.length + index }))
  ];
}
