import type { AbilityTestKind } from "./abilityTests.js";

export const aonSourcePdfIds = [
  "switch_challenge",
  "scales_clx",
  "scales_numerical"
] as const;

export type AonSourcePdfId = (typeof aonSourcePdfIds)[number];

export interface AonSourcePdfMeta {
  id: AonSourcePdfId;
  title: string;
  filename: string;
  relatedTestKind: AbilityTestKind;
}

/**
 * Fixed catalog of Aon practice PDFs the in-app tests were built from.
 * Unknown ids must never resolve to a filesystem path.
 */
export const aonSourcePdfs: readonly AonSourcePdfMeta[] = [
  {
    id: "switch_challenge",
    title: "Switch Challenge — øvingsoppgaver",
    filename: "practice-tasks-deductive-reasoning-switchchallenge.pdf",
    relatedTestKind: "switch_challenge"
  },
  {
    id: "scales_clx",
    title: "Scales CLX — øvingsoppgaver",
    filename: "practice-tasks---inductive-logical-reasoning-scales-clx.pdf",
    relatedTestKind: "scales_clx"
  },
  {
    id: "scales_numerical",
    title: "Numerisk resonnering — øvingsoppgaver",
    filename: "practice-tasks---numerical-reasoning.pdf",
    relatedTestKind: "scales_numerical"
  }
];

export function getAonSourcePdf(id: string): AonSourcePdfMeta | undefined {
  return aonSourcePdfs.find((pdf) => pdf.id === id);
}

export function isAonSourcePdfId(id: string): id is AonSourcePdfId {
  return (aonSourcePdfIds as readonly string[]).includes(id);
}
