import { describe, expect, it } from "vitest";
import {
  answerStatement,
  buildStatementReport,
  finishStatementSession,
  isStatementExpired,
  navigateStatement,
  startStatementSession,
  statementRemainingMs
} from "./statementTest.js";
import type { StatementTest } from "./statementTest.js";

function sampleTest(): StatementTest {
  return {
    kind: "scales_numerical",
    seed: 1,
    sheets: [
      {
        id: "ark-1",
        title: "Test",
        kind: "passage",
        text: "Tekst."
      }
    ],
    statements: [
      {
        id: "s1",
        sheetId: "ark-1",
        text: "A",
        verdict: "true",
        rationale: "r1"
      },
      {
        id: "s2",
        sheetId: "ark-1",
        text: "B",
        verdict: "false",
        rationale: "r2"
      },
      {
        id: "s3",
        sheetId: "ark-1",
        text: "C",
        verdict: "cannot_say",
        rationale: "r3"
      }
    ]
  };
}

describe("statementTest session", () => {
  it("rejects non-positive minutes", () => {
    expect(() => startStatementSession(sampleTest(), 0, 0)).toThrow();
  });

  it("allows changing answers before expiry", () => {
    let session = startStatementSession(sampleTest(), 12, 0);
    let r = answerStatement(session, "s1", "true", 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    session = r.session;
    r = answerStatement(session, "s1", "false", 2000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.session.answers.s1).toBe("false");
  });

  it("rejects answers after expiry", () => {
    const session = startStatementSession(sampleTest(), 1, 0);
    const expiredAt = 60_000;
    expect(isStatementExpired(session, expiredAt)).toBe(true);
    expect(statementRemainingMs(session, expiredAt)).toBe(0);
    const r = answerStatement(session, "s1", "true", expiredAt);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("expired");
  });

  it("scores +1 correct −1 wrong and counts unanswered", () => {
    let session = startStatementSession(sampleTest(), 12, 0);
    let r = answerStatement(session, "s1", "true", 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    session = r.session;
    r = answerStatement(session, "s2", "true", 20);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    session = finishStatementSession(r.session);
    const report = buildStatementReport(session);
    expect(report.correctCount).toBe(1);
    expect(report.wrongCount).toBe(1);
    expect(report.unansweredCount).toBe(1);
    expect(report.score).toBe(0);
  });

  it("tracks time when navigating", () => {
    let session = startStatementSession(sampleTest(), 12, 0);
    const nav = navigateStatement(session, 1, 5000, 0);
    expect(nav.ok).toBe(true);
    if (!nav.ok) return;
    session = nav.session;
    expect(session.currentStatementIndex).toBe(1);
    expect(session.timeSpentMs.s1).toBe(5000);
  });
});
