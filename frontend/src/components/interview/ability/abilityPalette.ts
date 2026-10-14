import type { ClxColor, ClxShape, SwitchSymbol } from "@careercenter/shared";
import type { AbilityShapeKind } from "./AbilityShape.vue";

export const switchSymbolColor: Record<SwitchSymbol, string> = {
  triangle: "#1b2a7a",
  circle: "#d6105f",
  cross: "#f7a400",
  star: "#6a1b8a"
};

export const clxColorHex: Record<ClxColor, string> = {
  yellow: "#f9c51d",
  red: "#c4161c",
  green: "#3d8b2f",
  blue: "#1f5f86"
};

export const clxShapeKind: Record<ClxShape, AbilityShapeKind> = {
  circle: "circle",
  square: "square",
  triangle: "triangle",
  plus: "cross"
};
