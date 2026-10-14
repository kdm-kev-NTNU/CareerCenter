/** Seeded RNG (mulberry32) for reproducible ability-test puzzles. */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type SwitchSymbol = "triangle" | "circle" | "cross" | "star";

export const SWITCH_SYMBOLS: SwitchSymbol[] = ["triangle", "circle", "cross", "star"];

/** Operator codes like "3241" mean: output[i] = input[code[i]-1]. */
export type SwitchOperator = string;

export interface SwitchChallengePuzzle {
  seed: number;
  input: SwitchSymbol[];
  output: SwitchSymbol[];
  options: SwitchOperator[];
  /** Index into options of the correct operator. Always exactly one. */
  correctIndex: number;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randomPermutation(rng: () => number): number[] {
  const p = [1, 2, 3, 4];
  shuffleInPlace(p, rng);
  return p;
}

function permutationToCode(p: number[]): SwitchOperator {
  return p.join("");
}

function applyOperator(input: SwitchSymbol[], code: SwitchOperator): SwitchSymbol[] {
  return code.split("").map((digit) => {
    const from = Number(digit) - 1;
    return input[from]!;
  });
}

function randomDistinctSymbols(rng: () => number): SwitchSymbol[] {
  const symbols = [...SWITCH_SYMBOLS];
  shuffleInPlace(symbols, rng);
  return symbols;
}

/**
 * Generate a Switch Challenge puzzle.
 * Invariant: exactly one option maps input → output.
 */
export function generateSwitchChallenge(seed: number, distractorCount = 2): SwitchChallengePuzzle {
  const rng = createSeededRng(seed);
  const input = randomDistinctSymbols(rng);
  const correctPerm = randomPermutation(rng);
  // Avoid identity unless forced by unlucky shuffle of distractors later
  if (correctPerm.join("") === "1234") {
    [correctPerm[0], correctPerm[1]] = [correctPerm[1]!, correctPerm[0]!];
  }
  const correct = permutationToCode(correctPerm);
  const output = applyOperator(input, correct);

  const options = new Set<SwitchOperator>([correct]);
  let guard = 0;
  while (options.size < distractorCount + 1 && guard < 100) {
    guard++;
    const d = permutationToCode(randomPermutation(rng));
    if (d === correct) continue;
    // Only keep distractors that do NOT also produce the same output
    const alt = applyOperator(input, d);
    if (alt.every((s, i) => s === output[i])) continue;
    options.add(d);
  }

  const optionList = [...options];
  shuffleInPlace(optionList, rng);
  const correctIndex = optionList.indexOf(correct);

  return { seed, input, output, options: optionList, correctIndex };
}

export function isCorrectSwitchAnswer(puzzle: SwitchChallengePuzzle, optionIndex: number): boolean {
  return optionIndex === puzzle.correctIndex;
}
