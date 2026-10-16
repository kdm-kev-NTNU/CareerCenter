import { describe, expect, it } from "vitest";
import {
  generateVerbalReasoning,
  VERBAL_PASSAGE_BANK,
  VERBAL_REASONING_STATEMENT_COUNT
} from "./verbalReasoning.js";

describe("verbal reasoning bank", () => {
  it("has unique passage ids and all three verdicts per passage", () => {
    const ids = VERBAL_PASSAGE_BANK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const passage of VERBAL_PASSAGE_BANK) {
      const verdicts = new Set(passage.statements.map((s) => s.verdict));
      expect(verdicts.has("true")).toBe(true);
      expect(verdicts.has("false")).toBe(true);
      expect(verdicts.has("cannot_say")).toBe(true);
      expect(passage.text.length).toBeGreaterThan(80);
    }
  });
});

describe("generateVerbalReasoning", () => {
  it("is deterministic for the same seed", () => {
    expect(generateVerbalReasoning(99)).toEqual(generateVerbalReasoning(99));
  });

  it("produces ~49 statements referencing existing passages", () => {
    const test = generateVerbalReasoning(3);
    expect(test.kind).toBe("scales_verbal");
    expect(test.statements).toHaveLength(VERBAL_REASONING_STATEMENT_COUNT);
    const sheetIds = new Set(test.sheets.map((s) => s.id));
    for (const st of test.statements) {
      expect(sheetIds.has(st.sheetId)).toBe(true);
      expect(st.rationale.length).toBeGreaterThan(10);
    }
  });
});
