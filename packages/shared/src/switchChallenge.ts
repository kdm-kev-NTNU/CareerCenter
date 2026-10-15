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

/** Adaptive level at which Stage 2 (two switch rows) begins. */
export const SWITCH_STAGE_TWO_FROM_LEVEL = 8;

export interface SwitchDifficulty {
  stage: 1 | 2;
  /** Number of code options per row. */
  optionCount: number;
  /** Prefer distractors that differ from the correct code by one swap. */
  nearDistractors: boolean;
}

/**
 * Maps adaptive level (1-based, increases on correct answers) to puzzle shape.
 * Levels 1–7: Stage 1 (single switch). Level 8+: Stage 2 (two rows × 3 codes).
 */
export function switchDifficulty(level: number): SwitchDifficulty {
  const clamped = Math.max(1, Math.floor(level));
  if (clamped >= SWITCH_STAGE_TWO_FROM_LEVEL) {
    return {
      stage: 2,
      optionCount: 3,
      nearDistractors: clamped >= SWITCH_STAGE_TWO_FROM_LEVEL + 2
    };
  }
  // Level 1–2: 2 options; 3–4: 3; 5–7: 4. Near distractors from level 4.
  const optionCount = clamped <= 2 ? 2 : clamped <= 4 ? 3 : 4;
  return {
    stage: 1,
    optionCount,
    nearDistractors: clamped >= 4
  };
}

export interface SwitchRow {
  options: SwitchOperator[];
  /** Constant preview grids under each code for this row. */
  previews: SwitchSymbol[][];
}

export interface SwitchChallengeStage1Puzzle {
  stage: 1;
  seed: number;
  level: number;
  input: SwitchSymbol[];
  output: SwitchSymbol[];
  options: SwitchOperator[];
  /** Index into options of the correct operator. Always exactly one. */
  correctIndex: number;
}

export interface SwitchChallengeStage2Puzzle {
  stage: 2;
  seed: number;
  level: number;
  input: SwitchSymbol[];
  output: SwitchSymbol[];
  rows: [SwitchRow, SwitchRow];
  /** Indices into rows[0].options and rows[1].options. Always exactly one valid pair. */
  correctPair: [number, number];
}

export type SwitchChallengePuzzle = SwitchChallengeStage1Puzzle | SwitchChallengeStage2Puzzle;

export type SwitchAnswer = number | [number, number];

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

export function applyOperator(input: SwitchSymbol[], code: SwitchOperator): SwitchSymbol[] {
  return code.split("").map((digit) => {
    const from = Number(digit) - 1;
    return input[from]!;
  });
}

function symbolsEqual(a: SwitchSymbol[], b: SwitchSymbol[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

function randomDistinctSymbols(rng: () => number): SwitchSymbol[] {
  const symbols = [...SWITCH_SYMBOLS];
  shuffleInPlace(symbols, rng);
  return symbols;
}

/** Swap two distinct positions in a permutation code. */
function swapDigits(code: SwitchOperator, i: number, j: number): SwitchOperator {
  const chars = code.split("");
  [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  return chars.join("");
}

function nearCodes(correct: SwitchOperator, rng: () => number): SwitchOperator[] {
  const pairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3]
  ];
  shuffleInPlace(pairs, rng);
  const out: SwitchOperator[] = [];
  for (const [i, j] of pairs) {
    const d = swapDigits(correct, i, j);
    if (d !== correct) out.push(d);
  }
  return out;
}

function nonIdentityCode(rng: () => number): SwitchOperator {
  const perm = randomPermutation(rng);
  if (perm.join("") === "1234") {
    [perm[0], perm[1]] = [perm[1]!, perm[0]!];
  }
  return permutationToCode(perm);
}

function generateStage1(seed: number, level: number, difficulty: SwitchDifficulty): SwitchChallengeStage1Puzzle {
  const rng = createSeededRng(seed);
  const input = randomDistinctSymbols(rng);
  const correct = nonIdentityCode(rng);
  const output = applyOperator(input, correct);
  const distractorCount = difficulty.optionCount - 1;

  const distractors: SwitchOperator[] = [];
  const seen = new Set<SwitchOperator>([correct]);

  if (difficulty.nearDistractors) {
    for (const d of nearCodes(correct, rng)) {
      if (distractors.length >= distractorCount) break;
      if (seen.has(d)) continue;
      const alt = applyOperator(input, d);
      if (symbolsEqual(alt, output)) continue;
      seen.add(d);
      distractors.push(d);
    }
  }

  let guard = 0;
  while (distractors.length < distractorCount && guard < 200) {
    guard++;
    const d = permutationToCode(randomPermutation(rng));
    if (seen.has(d)) continue;
    const alt = applyOperator(input, d);
    if (symbolsEqual(alt, output)) continue;
    seen.add(d);
    distractors.push(d);
  }

  const options = [correct, ...distractors];
  shuffleInPlace(options, rng);
  const correctIndex = options.indexOf(correct);

  return { stage: 1, seed, level, input, output, options, correctIndex };
}

/**
 * Stage 2: two rows × 3 codes. Answer is one code from each row.
 * Output = lower(upper(input)).
 * Top-row previews: each code applied to input.
 * Bottom-row previews: column-linked — lowerCode[i] applied to upperCode[i](input).
 * Invariant: exactly one of the 9 pairs yields output.
 */
function generateStage2(seed: number, level: number, difficulty: SwitchDifficulty): SwitchChallengeStage2Puzzle {
  for (let attempt = 0; attempt < 80; attempt++) {
    const attemptSeed = (seed + attempt * 9973) >>> 0;
    const rng = createSeededRng(attemptSeed);

    const input = randomDistinctSymbols(rng);
    const upperCorrect = nonIdentityCode(rng);
    const lowerCorrect = nonIdentityCode(rng);
    const mid = applyOperator(input, upperCorrect);
    const output = applyOperator(mid, lowerCorrect);

    const pickRowCodes = (correct: SwitchOperator): SwitchOperator[] | null => {
      const codes = new Set<SwitchOperator>([correct]);
      if (difficulty.nearDistractors) {
        for (const d of nearCodes(correct, rng)) {
          if (codes.size >= 3) break;
          codes.add(d);
        }
      }
      let guard = 0;
      while (codes.size < 3 && guard < 100) {
        guard++;
        codes.add(permutationToCode(randomPermutation(rng)));
      }
      if (codes.size < 3) return null;
      const list = [...codes];
      shuffleInPlace(list, rng);
      return list;
    };

    const upperOptions = pickRowCodes(upperCorrect);
    const lowerOptions = pickRowCodes(lowerCorrect);
    if (!upperOptions || !lowerOptions) continue;

    const matching: Array<[number, number]> = [];
    for (let u = 0; u < 3; u++) {
      for (let l = 0; l < 3; l++) {
        const afterUpper = applyOperator(input, upperOptions[u]!);
        const afterLower = applyOperator(afterUpper, lowerOptions[l]!);
        if (symbolsEqual(afterLower, output)) {
          matching.push([u, l]);
        }
      }
    }
    if (matching.length !== 1) continue;

    const correctPair = matching[0]!;
    const topPreviews = upperOptions.map((code) => applyOperator(input, code));
    // Column-linked: each bottom preview uses that column's upper result as mid-state.
    const bottomPreviews = lowerOptions.map((code, i) =>
      applyOperator(topPreviews[i]!, code)
    );

    return {
      stage: 2,
      seed,
      level,
      input,
      output,
      rows: [
        { options: upperOptions, previews: topPreviews },
        { options: lowerOptions, previews: bottomPreviews }
      ],
      correctPair
    };
  }

  throw new Error(`Kunne ikke generere Switch Challenge Stage 2 for seed=${seed} level=${level}.`);
}

/**
 * Generate a Switch Challenge puzzle for an adaptive level.
 * Invariant Stage 1: exactly one option maps input → output.
 * Invariant Stage 2: exactly one of 9 pairs maps input → output via composition.
 */
export function generateSwitchChallenge(seed: number, level = 1): SwitchChallengePuzzle {
  const difficulty = switchDifficulty(level);
  if (difficulty.stage === 1) {
    return generateStage1(seed, level, difficulty);
  }
  return generateStage2(seed, level, difficulty);
}

export function isCorrectSwitchAnswer(puzzle: SwitchChallengePuzzle, answer: SwitchAnswer): boolean {
  if (puzzle.stage === 1) {
    return typeof answer === "number" && answer === puzzle.correctIndex;
  }
  if (!Array.isArray(answer) || answer.length !== 2) return false;
  return answer[0] === puzzle.correctPair[0] && answer[1] === puzzle.correctPair[1];
}

/** Format a code for display, e.g. "3241" → "3-2-4-1". */
export function formatSwitchCode(code: SwitchOperator): string {
  return code.split("").join("-");
}
