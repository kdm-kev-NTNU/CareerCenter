import { describe, expect, it } from "vitest";
import { classifyCaseSource, inferKnowledgeKind } from "./interviewKnowledge.js";

describe("inferKnowledgeKind", () => {
  it("detects STAR material from filename", () => {
    expect(inferKnowledgeKind({ filename: "STAR-examples.docx" })).toBe("star");
  });

  it("detects case content", () => {
    expect(
      inferKnowledgeKind({ title: "McKinsey Case Interview", content: "Your client is a retailer..." })
    ).toBe("case");
  });

  it("falls back to other", () => {
    expect(inferKnowledgeKind({ title: "Random notes" })).toBe("other");
  });
});

describe("classifyCaseSource", () => {
  it("classifies casebooks", () => {
    expect(classifyCaseSource({ title: "Official Casebook 2024", entryCount: 12 })).toBe("casebook");
  });

  it("classifies mini cases from entry count", () => {
    expect(classifyCaseSource({ title: "Practice set", entryCount: 4 })).toBe("mini_cases");
  });

  it("classifies exhibit packs from keywords", () => {
    expect(classifyCaseSource({ filename: "market-entry-exhibits.pdf", entryCount: 1 })).toBe("exhibit_pack");
  });

  it("defaults to single case", () => {
    expect(classifyCaseSource({ title: "Profitability case", entryCount: 1 })).toBe("single_case");
  });
});
