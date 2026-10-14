import { describe, expect, it } from "vitest";
import { emptyStarScores, storiesToAnkiCsv, storyToAnkiRow, weakestStoryQueue } from "./storyBank.js";

describe("story bank helpers", () => {
  it("orders weakest stories first", () => {
    const ranked = weakestStoryQueue([
      { id: "a", title: "Strong", tags: [], scoreHistory: [], averageSum: 28 },
      { id: "b", title: "Weak", tags: [], scoreHistory: [], averageSum: 12 }
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("exports anki csv with escaped fields", () => {
    const row = storyToAnkiRow({
      title: 'Leadership "moment"',
      situation: "S1",
      task: "T1",
      action: "A1",
      result: "R1",
      tags: ["finance"]
    });
    const csv = storiesToAnkiCsv([row]);
    expect(csv).toContain("Front,Back,Tags");
    expect(csv).toContain('"Leadership ""moment"""');
  });

  it("provides neutral default star scores", () => {
    expect(emptyStarScores().openingAndStructure).toBe(3);
  });
});
