import { describe, expect, it } from "vitest";
import { assertSemester, competitionScopes } from "./index";

describe("shared helpers", () => {
  it("rejects unsupported semesters", () => {
    expect(() => assertSemester(6)).toThrow("Semester");
  });

  it("accepts supported semesters", () => {
    expect(assertSemester(7)).toBe(7);
  });

  it("defines competition geographic scopes", () => {
    expect(competitionScopes).toEqual(["NORWAY", "NORDICS", "EUROPE", "GLOBAL"]);
  });
});
