export const abilityTestKinds = [
  "switch_challenge",
  "scales_clx",
  "scales_numerical",
  "scales_verbal",
  "scales_mta"
] as const;
export type AbilityTestKind = (typeof abilityTestKinds)[number];

export const puzzleAbilityTestKinds = ["switch_challenge", "scales_clx"] as const;
export type PuzzleAbilityTestKind = (typeof puzzleAbilityTestKinds)[number];

export const statementAbilityTestKinds = ["scales_numerical", "scales_verbal"] as const;
export type StatementAbilityTestKind = (typeof statementAbilityTestKinds)[number];

export const mtaAbilityTestKinds = ["scales_mta"] as const;
export type MtaAbilityTestKind = (typeof mtaAbilityTestKinds)[number];

export function isStatementAbilityKind(kind: AbilityTestKind): kind is StatementAbilityTestKind {
  return (statementAbilityTestKinds as readonly string[]).includes(kind);
}

export function isPuzzleAbilityKind(kind: AbilityTestKind): kind is PuzzleAbilityTestKind {
  return (puzzleAbilityTestKinds as readonly string[]).includes(kind);
}

export function isMtaAbilityKind(kind: AbilityTestKind): kind is MtaAbilityTestKind {
  return (mtaAbilityTestKinds as readonly string[]).includes(kind);
}
