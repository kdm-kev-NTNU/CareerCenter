export const abilityTestKinds = ["switch_challenge", "scales_clx"] as const;
export type AbilityTestKind = (typeof abilityTestKinds)[number];
