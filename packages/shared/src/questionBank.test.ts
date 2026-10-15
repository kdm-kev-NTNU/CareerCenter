import { describe, expect, it } from "vitest";
import {
  categoryForDocKind,
  extractBankQuestions,
  findRepeatedStories,
  normalizeQuestionKey,
  rankBankQuestions,
  resolveCuratedSelection
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

describe("resolveCuratedSelection", () => {
  const candidates = Array.from({ length: 40 }, (_, i) => ({ id: `id-${i + 1}` }));

  it("maps aliases, drops unknowns, and fills up to min", () => {
    const refs = [
      ...Array.from({ length: 22 }, (_, i) => `Q${i + 1}`),
      "Q999",
      "bogus",
      "Q1"
    ];
    const result = resolveCuratedSelection(refs, candidates, { min: 30, max: 50 });
    expect(result.ids).toHaveLength(30);
    expect(result.filledCount).toBe(8);
    expect(result.droppedRefs).toEqual(["Q999", "bogus"]);
    expect(new Set(result.ids).size).toBe(30);
    for (const id of result.ids) {
      expect(candidates.some((c) => c.id === id)).toBe(true);
    }
  });

  it("caps at max and never exceeds candidate pool", () => {
    const small = Array.from({ length: 10 }, (_, i) => ({ id: `s-${i}` }));
    const result = resolveCuratedSelection(["Q1", "Q2"], small, { min: 30, max: 50 });
    expect(result.ids).toHaveLength(10);
    expect(result.filledCount).toBe(8);
  });

  it("keeps length in [min, max] when enough candidates exist", () => {
    for (const count of [0, 5, 30, 45, 60]) {
      const refs = Array.from({ length: count }, (_, i) => `Q${(i % 40) + 1}`);
      const result = resolveCuratedSelection(refs, candidates, { min: 30, max: 50 });
      expect(result.ids.length).toBeGreaterThanOrEqual(30);
      expect(result.ids.length).toBeLessThanOrEqual(50);
      expect(new Set(result.ids).size).toBe(result.ids.length);
    }
  });
});
