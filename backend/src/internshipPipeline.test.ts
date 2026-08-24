import { describe, expect, it } from "vitest";
import { InvalidReferenceError } from "./repository.js";
import { planInternshipStatusReorder } from "./internshipPipeline.js";

describe("planInternshipStatusReorder", () => {
  const statuses = [
    { id: "s1", label: "Søkt", kind: "stage" as const, sortOrder: 0 },
    { id: "s2", label: "Case", kind: "stage" as const, sortOrder: 1 },
    { id: "o1", label: "Tilbud", kind: "outcome" as const, sortOrder: 2 }
  ];

  it("reorders stages and keeps outcomes after the template", () => {
    const next = planInternshipStatusReorder(statuses, ["s2", "s1"]);
    expect(next.map((status) => status.id)).toEqual(["s2", "s1", "o1"]);
    expect(next.map((status) => status.sortOrder)).toEqual([0, 1, 2]);
  });

  it("rejects reorder payloads that are not a permutation of stages", () => {
    expect(() => planInternshipStatusReorder(statuses, ["s1"])).toThrow(
      new InvalidReferenceError("Ugyldig statusrekkefølge.")
    );
    expect(() => planInternshipStatusReorder(statuses, ["s1", "o1"])).toThrow(
      new InvalidReferenceError("Ugyldig statusrekkefølge.")
    );
  });
});
