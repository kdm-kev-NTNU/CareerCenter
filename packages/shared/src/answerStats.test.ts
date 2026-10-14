import { describe, expect, it } from "vitest";
import { answerStats } from "./answerStats.js";

describe("answerStats", () => {
  it("counts words, wpm and fillers", () => {
    const stats = answerStats("Eh I mean we basically shipped the feature like on time", 60_000);
    expect(stats.wordCount).toBeGreaterThan(5);
    expect(stats.wordsPerMinute).toBe(stats.wordCount);
    expect(stats.fillerCount).toBeGreaterThanOrEqual(3);
    expect(stats.fillers.eh ?? 0).toBeGreaterThanOrEqual(1);
  });
});
