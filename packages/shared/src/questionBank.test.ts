import { describe, expect, it } from "vitest";
import {
  extractBankQuestions,
  findRepeatedStories,
  rankBankQuestions
} from "./questionBank.js";

describe("extractBankQuestions", () => {
  it("extracts question lines and drops duplicates", () => {
    const extracted = extractBankQuestions({
      kind: "star",
      title: "STAR examples leadership",
      content: [
        "Intro text",
        "1. Tell me about a time you led a team?",
        "- How did you handle conflict?",
        "Not a question",
        "Tell me about a time you led a team?",
        "* Why do you want this role?"
      ].join("\n")
    });
    expect(extracted).toHaveLength(3);
    expect(extracted[0]?.category).toBe("behavioral");
    expect(extracted[0]?.tags).toContain("star");
    expect(extracted.map((q) => q.text)).toEqual([
      "Tell me about a time you led a team?",
      "How did you handle conflict?",
      "Why do you want this role?"
    ]);
  });
});

describe("rankBankQuestions", () => {
  it("ranks deterministically by theme hits then id", () => {
    const ranked = rankBankQuestions(
      {
        industries: ["banking"],
        themes: ["leadership", "risk"],
        caseTypes: ["profitability"],
        interviewFormats: ["case"],
        values: ["integrity"]
      },
      [
        { id: "b", text: "Tell me about leadership?", category: "behavioral", tags: [] },
        { id: "a", text: "Walk me through a risk case?", category: "case", tags: ["banking"] },
        { id: "c", text: "What is your hobby?", category: "motivation", tags: [] }
      ],
      10
    );
    expect(ranked.map((q) => q.id)).toEqual(["a", "b", "c"]);
  });
});

describe("findRepeatedStories", () => {
  it("returns story ids used more than once", () => {
    expect(
      findRepeatedStories([
        { id: "q1", storyId: "s1" },
        { id: "q2", storyId: "s2" },
        { id: "q3", storyId: "s1" },
        { id: "q4" }
      ])
    ).toEqual(["s1"]);
  });
});
