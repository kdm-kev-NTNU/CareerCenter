import { describe, expect, it } from "vitest";
import { internshipTemplateStageIds, isInternshipStage } from "./internshipStatus.js";

describe("internship status helpers", () => {
  it("treats missing kind as a pipeline stage", () => {
    expect(isInternshipStage({ kind: "stage" })).toBe(true);
    expect(isInternshipStage({})).toBe(true);
    expect(isInternshipStage({ kind: "outcome" })).toBe(false);
  });

  it("copies stage ids for the internship template", () => {
    expect(
      internshipTemplateStageIds([
        { id: "s1", kind: "stage" },
        { id: "o1", kind: "outcome" },
        { id: "s2" }
      ])
    ).toEqual(["s1", "s2"]);
  });
});
