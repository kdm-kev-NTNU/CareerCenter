import { describe, expect, it } from "vitest";
import { proposeCaseSpans, shouldChunkImport } from "./caseSpans.js";
import { formatPages, MAX_MODEL_CHARS } from "./documentPages.js";

function pages(bodies: string[]): string {
  return formatPages(bodies);
}

describe("proposeCaseSpans", () => {
  it("uses a table of contents as case boundaries", () => {
    const content = pages([
      ["Profitability .......... 2", "Market entry .......... 3"].join("\n"),
      `The bakery margin fell. ${"a".repeat(220)}`,
      `Sweden is the candidate market. ${"b".repeat(220)}`
    ]);

    const spans = proposeCaseSpans(content);
    expect(spans.map((span) => [span.title, span.pageStart, span.pageEnd, span.uncertain])).toEqual([
      ["Profitability", 2, 2, false],
      ["Market entry", 3, 3, false]
    ]);
  });

  it("keeps a short case separate instead of merging it", () => {
    const content = pages(["Case 1: Kort\nHei", `${"Case 2: Lang\n"}${"x".repeat(250)}`]);
    const spans = proposeCaseSpans(content);
    expect(spans).toHaveLength(2);
    expect(spans[0]?.uncertain).toBe(true);
    expect(spans[1]?.pageStart).toBe(2);
    expect(spans[0]?.pageEnd).toBe(1);
  });

  it("marks a document without headings as uncertain page windows", () => {
    const content = pages(["a".repeat(8_000), "b".repeat(8_000)]);
    const spans = proposeCaseSpans(content);
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.every((span) => span.uncertain)).toBe(true);
    expect(spans[0]?.pageEnd).toBeLessThan(spans[1]?.pageStart ?? 0);
  });

  it("splits one long case into bounded page ranges without dropping the tail", () => {
    const content = pages([
      `Case 1: Stor\n${"a".repeat(MAX_MODEL_CHARS)}`,
      "b".repeat(500),
      `Case 2: Neste\n${"c".repeat(250)}`
    ]);
    const spans = proposeCaseSpans(content);
    const firstCase = spans.filter((span) => span.title.startsWith("Case 1"));
    expect(firstCase.length).toBeGreaterThan(1);
    expect(firstCase.every((span) => span.uncertain)).toBe(true);
    expect(firstCase.some((span) => span.pageStart === 2)).toBe(true);
  });
});

describe("shouldChunkImport", () => {
  it("chunks casebooks and multi-span documents", () => {
    expect(shouldChunkImport({ content: "short", sourceKind: "casebook" })).toBe(true);
    expect(shouldChunkImport({ content: "exhibit pack", sourceKind: "exhibit_pack" })).toBe(false);
    expect(
      shouldChunkImport({
        content: pages([`Case 1: A\n${"a".repeat(250)}`, `Case 2: B\n${"b".repeat(250)}`]),
        sourceKind: "single_case"
      })
    ).toBe(true);
  });
});
