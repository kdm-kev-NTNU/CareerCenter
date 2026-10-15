import { describe, expect, it } from "vitest";
import {
  buildSessionReport,
  finishSession,
  isExpired,
  recordAnswer,
  remainingMs,
  startSession
} from "./abilitySession.js";
import type { SwitchChallengePuzzle } from "./switchChallenge.js";

describe("abilitySession", () => {
  it("starts at level 1 with one open puzzle", () => {
    const session = startSession("switch_challenge", 6, 1_000);
    expect(session.level).toBe(1);
    expect(session.peakLevel).toBe(1);
    expect(session.durationMs).toBe(6 * 60_000);
    expect(session.items).toHaveLength(1);
    expect(session.currentIndex).toBe(0);
    expect(session.finished).toBe(false);
  });

  it("raises Switch level on correct and stays on wrong", () => {
    let session = startSession("switch_challenge", 10, 0);
    const first = session.items[0]!;
    const puzzle = first.puzzle as SwitchChallengePuzzle;
    const correctAnswer =
      puzzle.stage === 1 ? puzzle.correctIndex : puzzle.correctPair;

    const ok = recordAnswer(session, correctAnswer, 1_000);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.session.level).toBe(2);
    expect(ok.session.peakLevel).toBe(2);
    expect(ok.session.items[0]!.correct).toBe(true);
    expect(ok.session.items).toHaveLength(2);

    session = ok.session;
    const second = session.items[1]!;
    const puzzle2 = second.puzzle as SwitchChallengePuzzle;
    // Pick a wrong answer
    let wrong: number | [number, number];
    if (puzzle2.stage === 1) {
      wrong = (puzzle2.correctIndex + 1) % puzzle2.options.length;
    } else {
      wrong = [
        (puzzle2.correctPair[0] + 1) % 3,
        puzzle2.correctPair[1]
      ];
    }
    const bad = recordAnswer(session, wrong, 2_000);
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    expect(bad.session.level).toBe(2);
    expect(bad.session.peakLevel).toBe(2);
    expect(bad.session.items[1]!.correct).toBe(false);
  });

  it("does not change level for Scales CLX", () => {
    const session = startSession("scales_clx", 5, 0);
    const puzzle = session.items[0]!.puzzle as { correctIndices: [number, number] };
    const result = recordAnswer(session, [...puzzle.correctIndices], 500);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.level).toBe(1);
    expect(result.session.items[0]!.correct).toBe(true);
  });

  it("rejects answers after expiry", () => {
    const session = startSession("switch_challenge", 1, 0);
    // 1 minute duration → expired at 60_000
    expect(isExpired(session, 60_000)).toBe(true);
    expect(remainingMs(session, 30_000)).toBe(30_000);
    const result = recordAnswer(session, 0, 60_000);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("buildSessionReport counts only answered items", () => {
    let session = startSession("switch_challenge", 10, 0);
    const puzzle = session.items[0]!.puzzle as SwitchChallengePuzzle;
    const correct =
      puzzle.stage === 1 ? puzzle.correctIndex : puzzle.correctPair;
    const after = recordAnswer(session, correct, 100);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    session = finishSession(after.session);
    const report = buildSessionReport(session);
    expect(report.answeredCount).toBe(1);
    expect(report.correctCount).toBe(1);
    expect(report.wrongCount).toBe(0);
    expect(report.peakLevel).toBe(2);
    expect(report.items).toHaveLength(1);
  });
});
