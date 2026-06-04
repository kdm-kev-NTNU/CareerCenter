import { describe, expect, it } from "vitest";
import {
  aiResourceKinds,
  aiResourceTargetTools,
  aiResourceWriteStrategies,
  assertSemester,
  competitionScopes
} from "./index";

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

  it("defines AI resource kinds and targets", () => {
    expect(aiResourceKinds).toContain("codex_instruction");
    expect(aiResourceKinds).toContain("cursor_rule");
    expect(aiResourceTargetTools).toEqual(["cursor", "codex"]);
    expect(aiResourceWriteStrategies).toContain("json_mcp_merge");
  });
});
