import { describe, expect, it } from "vitest";
import { CLX_SHAPE_COLOR, generateScalesClx, isCorrectClxSelection } from "./scalesClx.js";
import {
  applyOperator,
  generateSwitchChallenge,
  isCorrectSwitchAnswer,
  SWITCH_STAGE_TWO_FROM_LEVEL,
  switchDifficulty,
  type SwitchChallengeStage2Puzzle,
  type SwitchSymbol
} from "./switchChallenge.js";

describe("switchDifficulty", () => {
  it("keeps Stage 1 below level 8 and Stage 2 from level 8", () => {
    for (let level = 1; level < SWITCH_STAGE_TWO_FROM_LEVEL; level++) {
      expect(switchDifficulty(level).stage).toBe(1);
    }
    expect(switchDifficulty(SWITCH_STAGE_TWO_FROM_LEVEL).stage).toBe(2);
    expect(switchDifficulty(15).stage).toBe(2);
  });

  it("never decreases optionCount as level rises within Stage 1", () => {
    let prev = 0;
    for (let level = 1; level < SWITCH_STAGE_TWO_FROM_LEVEL; level++) {
      const { optionCount } = switchDifficulty(level);
      expect(optionCount).toBeGreaterThanOrEqual(prev);
      prev = optionCount;
    }
  });
});

describe("Switch Challenge generator", () => {
  it("Stage 1: exactly one correct option across levels 1–7 and many seeds", () => {
    for (let level = 1; level <= 7; level++) {
      for (let seed = 0; seed < 200; seed++) {
        const puzzle = generateSwitchChallenge(seed, level);
        expect(puzzle.stage).toBe(1);
        if (puzzle.stage !== 1) continue;
        expect(puzzle.options.length).toBe(switchDifficulty(level).optionCount);
        let matches = 0;
        for (let i = 0; i < puzzle.options.length; i++) {
          if (isCorrectSwitchAnswer(puzzle, i)) matches++;
        }
        expect(matches).toBe(1);
        expect(puzzle.correctIndex).toBeGreaterThanOrEqual(0);
        expect(puzzle.correctIndex).toBeLessThan(puzzle.options.length);
      }
    }
  });

  it("Stage 2: exactly one correct pair of nine across levels 8–15 and many seeds", () => {
    for (let level = 8; level <= 15; level++) {
      for (let seed = 0; seed < 80; seed++) {
        const puzzle = generateSwitchChallenge(seed, level);
        expect(puzzle.stage).toBe(2);
        if (puzzle.stage !== 2) continue;
        expect(puzzle.rows).toHaveLength(2);
        expect(puzzle.rows[0].options).toHaveLength(3);
        expect(puzzle.rows[1].options).toHaveLength(3);

        let matches = 0;
        for (let u = 0; u < 3; u++) {
          for (let l = 0; l < 3; l++) {
            if (isCorrectSwitchAnswer(puzzle, [u, l])) matches++;
          }
        }
        expect(matches).toBe(1);
        expect(isCorrectSwitchAnswer(puzzle, puzzle.correctPair)).toBe(true);
      }
    }
  });

  it("Stage 2 previews are column-linked and constant", () => {
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = generateSwitchChallenge(seed, 8);
      expect(puzzle.stage).toBe(2);
      if (puzzle.stage !== 2) continue;

      for (let i = 0; i < 3; i++) {
        const topPreview = applyOperator(puzzle.input, puzzle.rows[0].options[i]!);
        expect(puzzle.rows[0].previews[i]).toEqual(topPreview);

        const bottomPreview = applyOperator(topPreview, puzzle.rows[1].options[i]!);
        expect(puzzle.rows[1].previews[i]).toEqual(bottomPreview);
      }
    }
  });

  it("is deterministic for the same seed and level", () => {
    expect(generateSwitchChallenge(42, 3)).toEqual(generateSwitchChallenge(42, 3));
    expect(generateSwitchChallenge(42, 8)).toEqual(generateSwitchChallenge(42, 8));
  });

  it("regression: fixed Stage 2 board has unique correct pair 3241 then 2341", () => {
    // Mirrors the Aon layout: same three codes in both rows.
    // Input order: circle, star(≈square), triangle, cross — symbols available in our set.
    const input: SwitchSymbol[] = ["circle", "star", "triangle", "cross"];
    const codes = ["2341", "2431", "3241"] as const;
    const output = applyOperator(applyOperator(input, "3241"), "2341");

    const matching: Array<[number, number]> = [];
    for (let u = 0; u < 3; u++) {
      for (let l = 0; l < 3; l++) {
        const result = applyOperator(applyOperator(input, codes[u]!), codes[l]!);
        if (result.every((s, i) => s === output[i])) matching.push([u, l]);
      }
    }
    expect(matching).toEqual([[2, 0]]);

    const puzzle: SwitchChallengeStage2Puzzle = {
      stage: 2,
      seed: 0,
      level: 8,
      input,
      output,
      rows: [
        {
          options: [...codes],
          previews: codes.map((c) => applyOperator(input, c))
        },
        {
          options: [...codes],
          previews: codes.map((c, i) => applyOperator(applyOperator(input, codes[i]!), c))
        }
      ],
      correctPair: [2, 0]
    };
    expect(isCorrectSwitchAnswer(puzzle, [2, 0])).toBe(true);
    expect(isCorrectSwitchAnswer(puzzle, [0, 0])).toBe(false);
  });
});

describe("Scales CLX generator", () => {
  it("always has exactly two correct candidates across 2000 seeds", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const puzzle = generateScalesClx(seed);
      expect(puzzle.candidates).toHaveLength(4);
      expect(puzzle.correctIndices).toHaveLength(2);
      expect(new Set(puzzle.correctIndices).size).toBe(2);
      expect(isCorrectClxSelection(puzzle, [...puzzle.correctIndices])).toBe(true);
      expect(isCorrectClxSelection(puzzle, [0])).toBe(false);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(generateScalesClx(99)).toEqual(generateScalesClx(99));
  });

  it("gives every shape its one fixed color", () => {
    for (let seed = 0; seed < 200; seed++) {
      const puzzle = generateScalesClx(seed);
      for (const grid of [...puzzle.examples, ...puzzle.candidates]) {
        for (const item of grid) {
          expect(item.color).toBe(CLX_SHAPE_COLOR[item.shape]);
        }
      }
    }
  });
});
