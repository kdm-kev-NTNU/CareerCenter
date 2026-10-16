import { buildSectionAttemptHistory, type InterviewSessionDto } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { formatScoreDelta, sectionCardView } from "./sectionCardView.js";

function finished(id: string, finishedAt: string, sum: number | undefined): InterviewSessionDto {
  return {
    id,
    mode: "behavioral_mock",
    title: "",
    prepPlanId: "plan",
    planSection: "behavioral",
    finishedAt,
    feedback: sum === undefined ? undefined : { scores: {} as never, sum, improvement: "" },
    createdAt: finishedAt,
    updatedAt: finishedAt
  };
}

const history = buildSectionAttemptHistory([
  finished("a", "2026-10-03T10:00:00.000Z", 9),
  finished("b", "2026-10-04T10:00:00.000Z", 14)
]);

describe("sectionCardView", () => {
  it("shows the unpractised meta for a section without attempts", () => {
    expect(sectionCardView(history, "motivation", "3 spørsmål", null)).toEqual({ done: false, meta: "3 spørsmål" });
  });

  it("shows the latest version, sum and delta for a practised section", () => {
    expect(sectionCardView(history, "behavioral", "4 spørsmål", null)).toEqual({
      done: true,
      meta: "v2 · sum 14 (+5)"
    });
  });

  it("shows a practised section as unpractised while it is the fresh start", () => {
    expect(sectionCardView(history, "behavioral", "4 spørsmål", "behavioral")).toEqual({
      done: false,
      meta: "4 spørsmål"
    });
  });

  it("only resets the section that is the fresh start", () => {
    expect(sectionCardView(history, "behavioral", "4 spørsmål", "full").done).toBe(true);
  });

  it("shows only the version when the latest attempt has no score", () => {
    const unscored = buildSectionAttemptHistory([finished("a", "2026-10-03T10:00:00.000Z", undefined)]);
    expect(sectionCardView(unscored, "behavioral", "4 spørsmål", null)).toEqual({ done: true, meta: "v1" });
  });
});

describe("formatScoreDelta", () => {
  it("formats positive, negative and missing deltas", () => {
    expect(formatScoreDelta(3)).toBe(" (+3)");
    expect(formatScoreDelta(-2)).toBe(" (-2)");
    expect(formatScoreDelta(0)).toBe(" (0)");
    expect(formatScoreDelta(undefined)).toBe("");
  });
});
