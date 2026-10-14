import { describe, expect, it } from "vitest";
import { generateScalesClx, isCorrectClxSelection } from "./scalesClx.js";
import { generateSwitchChallenge, isCorrectSwitchAnswer } from "./switchChallenge.js";

describe("Switch Challenge generator", () => {
  it("always has exactly one correct option across 2000 seeds", () => {
    for (let seed = 0; seed < 2000; seed++) {
      const puzzle = generateSwitchChallenge(seed);
      expect(puzzle.options.length).toBeGreaterThanOrEqual(2);
      let matches = 0;
      for (let i = 0; i < puzzle.options.length; i++) {
        if (isCorrectSwitchAnswer(puzzle, i)) matches++;
      }
      expect(matches).toBe(1);
      expect(puzzle.correctIndex).toBeGreaterThanOrEqual(0);
      expect(puzzle.correctIndex).toBeLessThan(puzzle.options.length);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = generateSwitchChallenge(42);
    const b = generateSwitchChallenge(42);
    expect(a).toEqual(b);
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
});
