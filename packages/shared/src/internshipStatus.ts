export const internshipStatusKinds = ["stage", "outcome"] as const;
export type InternshipStatusKind = (typeof internshipStatusKinds)[number];

export interface InternshipStatusOption {
  id: string;
  label: string;
  kind: InternshipStatusKind;
  sortOrder: number;
}

export function isInternshipStage(status: { kind?: InternshipStatusKind }): boolean {
  return status.kind !== "outcome";
}

export function internshipTemplateStageIds(
  statuses: Array<{ id: string; kind?: InternshipStatusKind }>
): string[] {
  return statuses.filter(isInternshipStage).map((status) => status.id);
}
