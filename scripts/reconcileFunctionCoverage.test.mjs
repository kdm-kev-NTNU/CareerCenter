import assert from "node:assert/strict";
import test from "node:test";
import { reconcileFunctionHits } from "./reconcileFunctionCoverage.mjs";

test("counts a function whose body statements ran", () => {
  const coverageData = {
    fnMap: {
      "1": {
        name: "_sfc_render",
        loc: { start: { line: 10, column: 0 }, end: { line: 12, column: 1 } }
      }
    },
    f: { "1": 0 },
    statementMap: {
      "1": { start: { line: 11, column: 2 }, end: { line: 11, column: 8 } }
    },
    s: { "1": 4 }
  };

  assert.equal(reconcileFunctionHits(coverageData), 1);
  assert.equal(coverageData.f["1"], 1);
});

test("leaves an uncalled arrow uncovered when only the enclosing line ran", () => {
  const coverageData = {
    fnMap: {
      "1": {
        name: "deleteKnowledge",
        loc: { start: { line: 52, column: 19 }, end: { line: 52, column: 105 } }
      }
    },
    f: { "1": 0 },
    statementMap: {
      "1": { start: { line: 52, column: 0 }, end: { line: 52, column: 105 } },
      "2": { start: { line: 52, column: 23 }, end: { line: 52, column: 63 } }
    },
    s: { "1": 16, "2": 0 }
  };

  assert.equal(reconcileFunctionHits(coverageData), 0);
  assert.equal(coverageData.f["1"], 0);
});

test("keeps an existing function hit", () => {
  const coverageData = {
    fnMap: {
      "1": {
        name: "getStatus",
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } }
      }
    },
    f: { "1": 3 },
    statementMap: {},
    s: {}
  };

  assert.equal(reconcileFunctionHits(coverageData), 0);
  assert.equal(coverageData.f["1"], 3);
});
