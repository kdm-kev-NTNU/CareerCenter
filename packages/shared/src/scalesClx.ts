import { createSeededRng } from "./switchChallenge.js";

export type ClxShape = "circle" | "square" | "triangle" | "plus";
export type ClxColor = "yellow" | "red" | "green" | "blue";

export interface ClxCell {
  shape: ClxShape;
  color: ClxColor;
}

export type ClxGrid = ClxCell[]; // length 9, row-major

export interface ScalesClxPuzzle {
  seed: number;
  ruleId: string;
  examples: [ClxGrid, ClxGrid];
  candidates: ClxGrid[];
  /** Exactly two indices into candidates that follow the rule. */
  correctIndices: [number, number];
}

const SHAPES: ClxShape[] = ["circle", "square", "triangle", "plus"];

/** Each shape has one fixed color, as in the Aon practice material; the rule is about shapes only. */
export const CLX_SHAPE_COLOR: Record<ClxShape, ClxColor> = {
  circle: "yellow",
  square: "red",
  triangle: "green",
  plus: "blue"
};

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function cell(shape: ClxShape): ClxCell {
  return { shape, color: CLX_SHAPE_COLOR[shape] };
}

/** Rule: exactly 7 of one shape, plus two other distinct single shapes. */
function followsSevenPlusTwo(grid: ClxGrid): boolean {
  const counts = new Map<ClxShape, number>();
  for (const cell of grid) {
    counts.set(cell.shape, (counts.get(cell.shape) ?? 0) + 1);
  }
  const values = [...counts.values()].sort((a, b) => b - a);
  return values[0] === 7 && values.length === 3 && values[1] === 1 && values[2] === 1;
}

function makeSevenPlusTwo(rng: () => number): ClxGrid {
  const majority = pick(SHAPES, rng);
  const others = SHAPES.filter((s) => s !== majority);
  shuffle(others, rng);
  const a = others[0]!;
  const b = others[1]!;
  const cells: ClxGrid = [];
  for (let i = 0; i < 7; i++) {
    cells.push(cell(majority));
  }
  cells.push(cell(a));
  cells.push(cell(b));
  shuffle(cells, rng);
  return cells;
}

function makeNotSevenPlusTwo(rng: () => number): ClxGrid {
  // 5+2+2 or 6+1+1+1 etc.
  const majority = pick(SHAPES, rng);
  const cells: ClxGrid = [];
  for (let i = 0; i < 5; i++) cells.push(cell(majority));
  const rest = SHAPES.filter((s) => s !== majority);
  shuffle(rest, rng);
  cells.push(cell(rest[0]!));
  cells.push(cell(rest[0]!));
  cells.push(cell(rest[1]!));
  cells.push(cell(rest[1]!));
  shuffle(cells, rng);
  return cells;
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Generate a Scales CLX-style puzzle with the "7+1+1 shapes" rule.
 * Invariant: exactly two of four candidates follow the rule.
 */
export function generateScalesClx(seed: number): ScalesClxPuzzle {
  const rng = createSeededRng(seed);
  const examples: [ClxGrid, ClxGrid] = [makeSevenPlusTwo(rng), makeSevenPlusTwo(rng)];
  const correctA = makeSevenPlusTwo(rng);
  const correctB = makeSevenPlusTwo(rng);
  const wrongA = makeNotSevenPlusTwo(rng);
  const wrongB = makeNotSevenPlusTwo(rng);
  if (!examples.every(followsSevenPlusTwo) || !followsSevenPlusTwo(correctA) || !followsSevenPlusTwo(correctB)) {
    throw new Error("CLX-rutenett som skal følge regelen gjør det ikke.");
  }
  if (followsSevenPlusTwo(wrongA) || followsSevenPlusTwo(wrongB)) {
    throw new Error("CLX-distraktor følger regelen.");
  }

  const candidates = [correctA, correctB, wrongA, wrongB];
  const order = [0, 1, 2, 3];
  shuffle(order, rng);
  const shuffled = order.map((i) => candidates[i]!);
  const correctIndices = order
    .map((orig, newIdx) => (orig < 2 ? newIdx : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b) as [number, number];

  return {
    seed,
    ruleId: "seven_plus_two_shapes",
    examples,
    candidates: shuffled,
    correctIndices
  };
}

export function isCorrectClxSelection(puzzle: ScalesClxPuzzle, selected: number[]): boolean {
  if (selected.length !== 2) return false;
  const sorted = [...selected].sort((a, b) => a - b);
  return sorted[0] === puzzle.correctIndices[0] && sorted[1] === puzzle.correctIndices[1];
}
