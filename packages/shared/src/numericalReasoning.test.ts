import { describe, expect, it } from "vitest";
import {
  generateNumericalReasoning,
  NUMERICAL_REASONING_SHEET_COUNT,
  NUMERICAL_REASONING_STATEMENT_COUNT,
  verifyStatementAgainstSheet
} from "./numericalReasoning.js";

describe("generateNumericalReasoning", () => {
  it("is deterministic for the same seed", () => {
    const a = generateNumericalReasoning(42);
    const b = generateNumericalReasoning(42);
    expect(a).toEqual(b);
  });

  it("produces expected sheet and statement counts", () => {
    const test = generateNumericalReasoning(7);
    expect(test.kind).toBe("scales_numerical");
    expect(test.sheets).toHaveLength(NUMERICAL_REASONING_SHEET_COUNT);
    expect(test.statements).toHaveLength(NUMERICAL_REASONING_STATEMENT_COUNT);
  });

  it("references existing sheets and includes all verdicts across seeds", () => {
    const verdicts = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const test = generateNumericalReasoning(seed);
      const sheetIds = new Set(test.sheets.map((s) => s.id));
      for (const st of test.statements) {
        expect(sheetIds.has(st.sheetId)).toBe(true);
        verdicts.add(st.verdict);
        const sheet = test.sheets.find((s) => s.id === st.sheetId)!;
        const verified = verifyStatementAgainstSheet(sheet, st);
        expect(verified).toBe(st.verdict);
      }
      // Pie slices sum to ~100
      for (const sheet of test.sheets) {
        if (sheet.kind === "pie") {
          const sum = sheet.slices.reduce((a, s) => a + s.percent, 0);
          expect(sum).toBe(100);
        }
      }
    }
    expect(verdicts.has("true")).toBe(true);
    expect(verdicts.has("false")).toBe(true);
    expect(verdicts.has("cannot_say")).toBe(true);
  });

  it("includes all three verdicts in a single generated test", () => {
    let found = false;
    for (let seed = 1; seed <= 50; seed++) {
      const test = generateNumericalReasoning(seed);
      const v = new Set(test.statements.map((s) => s.verdict));
      if (v.has("true") && v.has("false") && v.has("cannot_say")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
