import { describe, expect, it } from "vitest";
import { assertSemester, formatPath } from "./index";

describe("shared helpers", () => {
  it("formats a custom path", () => {
    expect(formatPath([{ name: "Statkraft" }, { name: "InCommodities" }, { name: "Vitol" }])).toBe(
      "NTNU KI -> Statkraft -> InCommodities -> Vitol"
    );
  });

  it("rejects unsupported semesters", () => {
    expect(() => assertSemester(6)).toThrow("Semester");
  });

  it("accepts supported semesters", () => {
    expect(assertSemester(7)).toBe(7);
  });
});
