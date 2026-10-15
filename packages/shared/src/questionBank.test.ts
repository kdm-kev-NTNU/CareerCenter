import { describe, expect, it } from "vitest";
import {
  categoryForDocKind,
  extractBankQuestions,
  findRepeatedStories,
  normalizeQuestionKey,
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

  it("joins soft-wrapped PDF lines into one question", () => {
    const extracted = extractBankQuestions({
      kind: "star",
      title: "Wrapped",
      content: ["Tell me about a time you", "led a team through change?"].join("\n")
    });
    expect(extracted.map((q) => q.text)).toEqual(["Tell me about a time you led a team through change?"]);
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

describe("rankBankQuestions filtering", () => {
  it("drops questions the candidate asks and discarded questions", () => {
    const profile = { industries: [], themes: [], caseTypes: [], interviewFormats: [], values: [] };
    const ranked = rankBankQuestions(profile, [
      { id: "a", text: "Fortell om en feil?", category: "behavioral", tags: [], audience: "candidate" },
      { id: "b", text: "Hva overrasket deg?", category: "personal", tags: [], audience: "ask_interviewer_personal" },
      { id: "c", text: "Hva er neste steg?", category: "company", tags: [], audience: "ask_interviewer_company" },
      { id: "d", text: "Spør alltid om en til?", category: "behavioral", tags: [], status: "discarded" },
      { id: "e", text: "Legacy row without audience?", category: "behavioral", tags: [] }
    ]);
    expect(ranked.map((q) => q.id)).toEqual(["a", "e"]);
  });
});

describe("categoryForDocKind", () => {
  it("maps brainteasers and strengths/weaknesses to their own categories", () => {
    expect(categoryForDocKind("brainteasers")).toBe("brainteaser");
    expect(categoryForDocKind("strengths_weaknesses")).toBe("personal");
    expect(categoryForDocKind("partner")).toBe("motivation");
    expect(categoryForDocKind("other")).toBe("behavioral");
  });
});

describe("normalizeQuestionKey", () => {
  it("ignores case, quotes, list markers and whitespace", () => {
    expect(normalizeQuestionKey("  - «Hva   gjør du på Fritiden?»")).toBe("hva gjør du på fritiden?");
    expect(normalizeQuestionKey("1. Hva gjør du på fritiden?")).toBe("hva gjør du på fritiden?");
    expect(normalizeQuestionKey("“Hva gjør du på fritiden?”")).toBe("hva gjør du på fritiden?");
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
