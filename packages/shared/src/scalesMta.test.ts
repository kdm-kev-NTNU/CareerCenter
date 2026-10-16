import { describe, expect, it } from "vitest";
import {
  MTA_AIRCRAFT_HEIGHT_MAX,
  MTA_AIRCRAFT_HEIGHT_MIN,
  MTA_AIRCRAFT_INTERVAL_MS,
  MTA_FLIGHT_DURATION_MS,
  MTA_GATE_CENTER_MAX,
  MTA_GATE_CENTER_MIN,
  MTA_GATE_STEP,
  MTA_LANDING_WINDOW_START,
  answerEquation,
  answerLetters,
  buildMtaReport,
  clickAircraft,
  finishMtaSession,
  generateScalesMta,
  isLandingHit,
  moveGate,
  resolveMissedAircraft,
  setGateCenter,
  startMtaSession
} from "./scalesMta.js";

describe("generateScalesMta", () => {
  it("is deterministic for the same seed", () => {
    const a = generateScalesMta(42, 60_000);
    const b = generateScalesMta(42, 60_000);
    expect(a).toEqual(b);
  });

  it("spaces aircraft evenly and keeps heights in range", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const timeline = generateScalesMta(seed, 60_000);
      expect(timeline.kind).toBe("scales_mta");
      expect(timeline.aircraft.length).toBeGreaterThan(5);
      for (let i = 1; i < timeline.aircraft.length; i++) {
        const prev = timeline.aircraft[i - 1]!;
        const cur = timeline.aircraft[i]!;
        expect(cur.startOffsetMs - prev.startOffsetMs).toBe(MTA_AIRCRAFT_INTERVAL_MS);
      }
      for (const ac of timeline.aircraft) {
        expect(ac.height).toBeGreaterThanOrEqual(MTA_AIRCRAFT_HEIGHT_MIN);
        expect(ac.height).toBeLessThanOrEqual(MTA_AIRCRAFT_HEIGHT_MAX);
      }
    }
  });

  it("equation fasit matches the true sum", () => {
    const seenCorrect = { true: 0, false: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const timeline = generateScalesMta(seed, 30_000);
      for (const eq of timeline.equations) {
        const sum = eq.addends.reduce((a, b) => a + b, 0);
        expect(eq.isCorrect).toBe(eq.displayedSum === sum);
        if (eq.isCorrect) {
          expect(eq.displayedSum).toBe(sum);
          seenCorrect.true += 1;
        } else {
          expect(eq.displayedSum).not.toBe(sum);
          const delta = Math.abs(eq.displayedSum - sum);
          expect(delta).toBeGreaterThanOrEqual(1);
          expect(delta).toBeLessThanOrEqual(3);
          seenCorrect.false += 1;
        }
      }
    }
    expect(seenCorrect.true).toBeGreaterThan(0);
    expect(seenCorrect.false).toBeGreaterThan(0);
  });

  it("letter fasit matches whether any letter appears twice", () => {
    const seen = { dup: 0, unique: 0 };
    for (let seed = 1; seed <= 30; seed++) {
      const timeline = generateScalesMta(seed, 30_000);
      for (const chain of timeline.letterChains) {
        expect(chain.letters).toHaveLength(7);
        const counts = new Map<string, number>();
        for (const ch of chain.letters) {
          counts.set(ch, (counts.get(ch) ?? 0) + 1);
        }
        const hasDup = [...counts.values()].some((n) => n >= 2);
        expect(chain.hasDuplicate).toBe(hasDup);
        if (hasDup) seen.dup += 1;
        else seen.unique += 1;
      }
    }
    expect(seen.dup).toBeGreaterThan(0);
    expect(seen.unique).toBeGreaterThan(0);
  });
});

describe("MTA session", () => {
  const t0 = 1_000_000;

  it("lands when the player aligns the gate and clicks in the window", () => {
    const timeline = generateScalesMta(3, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    expect(session.gateCenter).toBe(0.5);

    const aligned = setGateCenter(session, ac.height, t0);
    expect(aligned.ok).toBe(true);
    if (!aligned.ok) return;
    session = aligned.session;
    expect(session.gateCenter).toBeCloseTo(ac.height);

    const hitOffset =
      ac.startOffsetMs + Math.floor(MTA_FLIGHT_DURATION_MS * ((MTA_LANDING_WINDOW_START + 1) / 2));
    expect(isLandingHit(session, ac, hitOffset)).toBe(true);

    const result = clickAircraft(session, t0 + hitOffset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.aircraftJudgments[0]!.outcome).toBe("landed");
  });

  it("misses when the gate is not aligned, even in the landing window", () => {
    const timeline = generateScalesMta(5, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    // Put gate far from the aircraft
    const far =
      ac.height > 0.5 ? MTA_GATE_CENTER_MIN : MTA_GATE_CENTER_MAX;
    const moved = setGateCenter(session, far, t0);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    session = moved.session;

    const hitOffset =
      ac.startOffsetMs + Math.floor(MTA_FLIGHT_DURATION_MS * ((MTA_LANDING_WINDOW_START + 1) / 2));
    expect(isLandingHit(session, ac, hitOffset)).toBe(false);

    const result = clickAircraft(session, t0 + hitOffset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.aircraftJudgments[0]!.outcome).toBe("miss");
  });

  it("misses when clicked outside the landing window", () => {
    const timeline = generateScalesMta(5, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    const aligned = setGateCenter(session, ac.height, t0);
    if (!aligned.ok) return;
    session = aligned.session;

    const early = t0 + ac.startOffsetMs + Math.floor(MTA_FLIGHT_DURATION_MS * 0.2);
    const result = clickAircraft(session, early);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.aircraftJudgments[0]!.outcome).toBe("miss");
  });

  it("auto-misses aircraft that pass the runway without a click", () => {
    const timeline = generateScalesMta(8, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    const after = t0 + ac.startOffsetMs + MTA_FLIGHT_DURATION_MS + 1;
    session = resolveMissedAircraft(session, after);
    expect(session.aircraftJudgments.some((j) => j.aircraftId === ac.id && j.outcome === "miss")).toBe(
      true
    );
  });

  it("moves the gate only when the player nudges it", () => {
    const timeline = generateScalesMta(1, 10_000);
    let session = startMtaSession(timeline, 1, t0);
    const start = session.gateCenter;
    // Time passing alone must not move the gate
    expect(session.gateCenter).toBe(start);

    const down = moveGate(session, MTA_GATE_STEP, t0 + 100);
    expect(down.ok).toBe(true);
    if (!down.ok) return;
    session = down.session;
    expect(session.gateCenter).toBeCloseTo(start + MTA_GATE_STEP);

    const up = moveGate(session, -MTA_GATE_STEP * 2, t0 + 200);
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.session.gateCenter).toBeCloseTo(start - MTA_GATE_STEP);
  });

  it("clamps gate movement to the playable band", () => {
    const timeline = generateScalesMta(1, 10_000);
    const session = startMtaSession(timeline, 1, t0);
    const top = moveGate(session, -10, t0);
    expect(top.ok).toBe(true);
    if (!top.ok) return;
    expect(top.session.gateCenter).toBe(MTA_GATE_CENTER_MIN);

    const bottom = moveGate(session, 10, t0);
    expect(bottom.ok).toBe(true);
    if (!bottom.ok) return;
    expect(bottom.session.gateCenter).toBe(MTA_GATE_CENTER_MAX);
  });

  it("scores side tasks +1 / −1 and rejects answers after expiry", () => {
    const timeline = generateScalesMta(11, 60_000);
    let session = startMtaSession(timeline, 1, t0);

    const eq = timeline.equations[0]!;
    const eqAnswer = eq.isCorrect ? "correct" : "wrong";
    let result = answerEquation(session, eqAnswer, t0 + 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;

    const eq2 = timeline.equations[1]!;
    const bad = eq2.isCorrect ? "wrong" : "correct";
    result = answerEquation(session, bad, t0 + 200);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;

    const lt = timeline.letterChains[0]!;
    const ltAnswer = lt.hasDuplicate ? "correct" : "wrong";
    result = answerLetters(session, ltAnswer, t0 + 300);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    session = result.session;

    session = finishMtaSession(session, t0 + 400);
    const report = buildMtaReport(session);
    expect(report.equationCorrect).toBe(1);
    expect(report.equationWrong).toBe(1);
    expect(report.letterCorrect).toBe(1);
    expect(report.score).toBe(1 - 1 + 1);

    const short = startMtaSession(timeline, 1 / 60, t0);
    const expired = answerEquation(short, "correct", t0 + 2_000);
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.reason).toBe("expired");
  });
});
