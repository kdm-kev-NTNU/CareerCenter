import { describe, expect, it } from "vitest";
import {
  MTA_AIRCRAFT_HALF_HEIGHT,
  MTA_AIRCRAFT_HEIGHT_MAX,
  MTA_AIRCRAFT_HEIGHT_MIN,
  MTA_AIRCRAFT_INTERVAL_MS,
  MTA_FLIGHT_DURATION_MS,
  MTA_GATE_CENTER_MAX,
  MTA_GATE_CENTER_MIN,
  MTA_GATE_HALF_HEIGHT,
  MTA_GATE_STEP,
  aircraftOverlapsGate,
  answerEquation,
  answerLetters,
  buildMtaReport,
  finishMtaSession,
  generateScalesMta,
  moveGate,
  resolveArrivedAircraft,
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

describe("aircraftOverlapsGate", () => {
  it("matches interval overlap of aircraft and gate vertical spans", () => {
    const threshold = MTA_GATE_HALF_HEIGHT + MTA_AIRCRAFT_HALF_HEIGHT;
    for (let seed = 0; seed < 40; seed++) {
      const height = 0.1 + (seed / 40) * 0.8;
      for (let g = 0; g < 20; g++) {
        const gate = 0.1 + (g / 20) * 0.8;
        const expected = Math.abs(height - gate) <= threshold;
        const acTop = height - MTA_AIRCRAFT_HALF_HEIGHT;
        const acBottom = height + MTA_AIRCRAFT_HALF_HEIGHT;
        const gateTop = gate - MTA_GATE_HALF_HEIGHT;
        const gateBottom = gate + MTA_GATE_HALF_HEIGHT;
        const intervalOverlap = acTop <= gateBottom && gateTop <= acBottom;
        expect(aircraftOverlapsGate(height, gate)).toBe(expected);
        expect(aircraftOverlapsGate(height, gate)).toBe(intervalOverlap);
        expect(aircraftOverlapsGate(height, gate)).toBe(aircraftOverlapsGate(gate, height));
      }
    }
  });

  it("counts edge overlap where centers are outside the gate half-height", () => {
    const gate = 0.5;
    // Center just outside the old center-only hitbox, but plane edge still overlaps.
    const justOutsideCenter = gate + MTA_GATE_HALF_HEIGHT + 0.01;
    expect(Math.abs(justOutsideCenter - gate)).toBeGreaterThan(MTA_GATE_HALF_HEIGHT);
    expect(aircraftOverlapsGate(justOutsideCenter, gate)).toBe(true);

    const beyond = gate + MTA_GATE_HALF_HEIGHT + MTA_AIRCRAFT_HALF_HEIGHT + 0.001;
    expect(aircraftOverlapsGate(beyond, gate)).toBe(false);
  });
});

describe("MTA session", () => {
  const t0 = 1_000_000;

  function arrivalTime(acStartOffsetMs: number): number {
    return t0 + acStartOffsetMs + MTA_FLIGHT_DURATION_MS;
  }

  it("lands when the gate is aligned at arrival", () => {
    const timeline = generateScalesMta(3, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);

    const aligned = setGateCenter(session, ac.height, t0);
    expect(aligned.ok).toBe(true);
    if (!aligned.ok) return;
    session = aligned.session;

    session = resolveArrivedAircraft(session, arrivalTime(ac.startOffsetMs));
    expect(session.aircraftJudgments[0]).toMatchObject({
      aircraftId: ac.id,
      outcome: "landed",
      durationMs: MTA_FLIGHT_DURATION_MS
    });
  });

  it("misses when the gate is far from the aircraft at arrival", () => {
    const timeline = generateScalesMta(5, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    const far = ac.height > 0.5 ? MTA_GATE_CENTER_MIN : MTA_GATE_CENTER_MAX;
    const moved = setGateCenter(session, far, t0);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    session = moved.session;

    session = resolveArrivedAircraft(session, arrivalTime(ac.startOffsetMs));
    expect(session.aircraftJudgments[0]).toMatchObject({
      aircraftId: ac.id,
      outcome: "miss"
    });
  });

  it("lands on edge overlap that the old center-only check would miss", () => {
    const timeline = generateScalesMta(7, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);

    // Place gate so aircraft center is outside GATE_HALF but still overlaps.
    const gate =
      ac.height + MTA_GATE_HALF_HEIGHT + MTA_AIRCRAFT_HALF_HEIGHT * 0.5;
    const clamped = Math.min(MTA_GATE_CENTER_MAX, Math.max(MTA_GATE_CENTER_MIN, gate));
    // Skip if clamping would change the intended geometry.
    if (Math.abs(clamped - gate) > 1e-9) {
      const altGate =
        ac.height - MTA_GATE_HALF_HEIGHT - MTA_AIRCRAFT_HALF_HEIGHT * 0.5;
      const altClamped = Math.min(
        MTA_GATE_CENTER_MAX,
        Math.max(MTA_GATE_CENTER_MIN, altGate)
      );
      expect(Math.abs(altClamped - altGate)).toBeLessThan(1e-9);
      const moved = setGateCenter(session, altClamped, t0);
      expect(moved.ok).toBe(true);
      if (!moved.ok) return;
      session = moved.session;
      expect(Math.abs(ac.height - session.gateCenter)).toBeGreaterThan(MTA_GATE_HALF_HEIGHT);
      expect(aircraftOverlapsGate(ac.height, session.gateCenter)).toBe(true);
    } else {
      const moved = setGateCenter(session, clamped, t0);
      expect(moved.ok).toBe(true);
      if (!moved.ok) return;
      session = moved.session;
      expect(Math.abs(ac.height - session.gateCenter)).toBeGreaterThan(MTA_GATE_HALF_HEIGHT);
      expect(aircraftOverlapsGate(ac.height, session.gateCenter)).toBe(true);
    }

    session = resolveArrivedAircraft(session, arrivalTime(ac.startOffsetMs));
    expect(session.aircraftJudgments[0]!.outcome).toBe("landed");
  });

  it("resolves arrived aircraft before moving the gate (determinism)", () => {
    const timeline = generateScalesMta(9, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);

    const aligned = setGateCenter(session, ac.height, t0);
    expect(aligned.ok).toBe(true);
    if (!aligned.ok) return;
    session = aligned.session;

    // After arrival, try to move the gate away — judgment must use the old gate.
    const afterArrival = arrivalTime(ac.startOffsetMs) + 10;
    const far = ac.height > 0.5 ? MTA_GATE_CENTER_MIN : MTA_GATE_CENTER_MAX;
    const moved = setGateCenter(session, far, afterArrival);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.session.aircraftJudgments[0]).toMatchObject({
      aircraftId: ac.id,
      outcome: "landed"
    });
    expect(moved.session.gateCenter).toBeCloseTo(far);
  });

  it("does not judge aircraft still in flight", () => {
    const timeline = generateScalesMta(8, 60_000);
    const ac = timeline.aircraft[0]!;
    let session = startMtaSession(timeline, 1, t0);
    const midFlight = t0 + ac.startOffsetMs + Math.floor(MTA_FLIGHT_DURATION_MS * 0.5);
    session = resolveArrivedAircraft(session, midFlight);
    expect(session.aircraftJudgments).toHaveLength(0);
  });

  it("moves the gate only when the player nudges it", () => {
    const timeline = generateScalesMta(1, 10_000);
    let session = startMtaSession(timeline, 1, t0);
    const start = session.gateCenter;

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
