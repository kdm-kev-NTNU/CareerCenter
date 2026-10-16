import type { MtaAbilityTestKind } from "./abilityTests.js";
import { createSeededRng } from "./switchChallenge.js";

/** Time between aircraft departures (ms). */
export const MTA_AIRCRAFT_INTERVAL_MS = 4_000;
/** How long an aircraft takes to reach the runway bar (ms). */
export const MTA_FLIGHT_DURATION_MS = 3_500;
/** Normalized X of the runway bar (0–1). */
export const MTA_RUNWAY_X = 0.92;
/** Vertical half-height of the gray landing gate (0–1). */
export const MTA_GATE_HALF_HEIGHT = 0.09;
/**
 * Vertical half-height of the aircraft sprite (0–1 of sky height).
 * Shared by hit detection and rendering so visual size matches the hitbox.
 */
export const MTA_AIRCRAFT_HALF_HEIGHT = 0.04;
/** How far one arrow-key / button nudge moves the gate center. */
export const MTA_GATE_STEP = 0.05;
/** Playable band for the gate center (keeps the full gate on screen). */
export const MTA_GATE_CENTER_MIN = MTA_GATE_HALF_HEIGHT;
export const MTA_GATE_CENTER_MAX = 1 - MTA_GATE_HALF_HEIGHT;
/** Aircraft height band — player aligns the gate to these heights. */
export const MTA_AIRCRAFT_HEIGHT_MIN = MTA_GATE_CENTER_MIN;
export const MTA_AIRCRAFT_HEIGHT_MAX = MTA_GATE_CENTER_MAX;

const LETTER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type MtaBinaryAnswer = "correct" | "wrong";

export interface MtaAircraft {
  id: string;
  /** Offset from session start when this aircraft begins flying. */
  startOffsetMs: number;
  /** Normalized height (0 = top, 1 = bottom). */
  height: number;
}

export interface MtaEquation {
  id: string;
  addends: [number, number, number, number];
  /** Displayed sum — may differ from the true sum. */
  displayedSum: number;
  /** True when displayedSum equals the real sum. */
  isCorrect: boolean;
}

export interface MtaLetterChain {
  id: string;
  letters: string[];
  /** True when any letter appears twice. */
  hasDuplicate: boolean;
}

export interface MtaTimeline {
  kind: MtaAbilityTestKind;
  seed: number;
  aircraft: MtaAircraft[];
  equations: MtaEquation[];
  letterChains: MtaLetterChain[];
}

export type MtaAircraftOutcome = "landed" | "miss";

export interface MtaAircraftJudgment {
  aircraftId: string;
  outcome: MtaAircraftOutcome;
  /** Session-relative ms when judged. */
  atOffsetMs: number;
  durationMs: number;
}

export interface MtaSideJudgment {
  itemId: string;
  answer: MtaBinaryAnswer;
  correct: boolean;
  durationMs: number;
}

export interface MtaSession {
  timeline: MtaTimeline;
  durationMs: number;
  startedAt: number;
  /**
   * Player-controlled gray gate center (0–1). Does not move on its own —
   * use `moveGate` / `setGateCenter`.
   */
  gateCenter: number;
  aircraftJudgments: MtaAircraftJudgment[];
  equationJudgments: MtaSideJudgment[];
  letterJudgments: MtaSideJudgment[];
  equationIndex: number;
  letterIndex: number;
  /** When the current equation was shown (absolute ms). */
  equationOpenedAt: number;
  /** When the current letter chain was shown (absolute ms). */
  letterOpenedAt: number;
  finished: boolean;
}

export interface MtaSessionReport {
  kind: MtaAbilityTestKind;
  seed: number;
  landedCount: number;
  missCount: number;
  equationCorrect: number;
  equationWrong: number;
  letterCorrect: number;
  letterWrong: number;
  /** Landed +1; side tasks +1/−1. Misses do not change score. */
  score: number;
  durationMs: number;
  aircraftJudgments: MtaAircraftJudgment[];
  equationJudgments: MtaSideJudgment[];
  letterJudgments: MtaSideJudgment[];
}

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function trueSum(addends: [number, number, number, number]): number {
  return addends[0] + addends[1] + addends[2] + addends[3];
}

export function generateEquation(rng: () => number, id: string): MtaEquation {
  const addends: [number, number, number, number] = [
    pickInt(rng, 1, 9),
    pickInt(rng, 1, 9),
    pickInt(rng, 1, 9),
    pickInt(rng, 1, 9)
  ];
  const sum = trueSum(addends);
  const isCorrect = rng() < 0.5;
  let displayedSum = sum;
  if (!isCorrect) {
    const deltas = [-3, -2, -1, 1, 2, 3];
    displayedSum = sum + deltas[pickInt(rng, 0, deltas.length - 1)]!;
  }
  return { id, addends, displayedSum, isCorrect };
}

export function generateLetterChain(rng: () => number, id: string): MtaLetterChain {
  const hasDuplicate = rng() < 0.5;
  const used = new Set<string>();

  if (hasDuplicate) {
    const dup = LETTER_ALPHABET[pickInt(rng, 0, LETTER_ALPHABET.length - 1)]!;
    used.add(dup);
    const uniques: string[] = [];
    while (uniques.length < 5) {
      const ch = LETTER_ALPHABET[pickInt(rng, 0, LETTER_ALPHABET.length - 1)]!;
      if (used.has(ch)) continue;
      used.add(ch);
      uniques.push(ch);
    }
    const positions = [0, 1, 2, 3, 4, 5, 6];
    const slotA = positions.splice(pickInt(rng, 0, positions.length - 1), 1)[0]!;
    const slotB = positions.splice(pickInt(rng, 0, positions.length - 1), 1)[0]!;
    const result = new Array<string>(7);
    result[slotA] = dup;
    result[slotB] = dup;
    let ui = 0;
    for (let i = 0; i < 7; i++) {
      if (result[i] == null) result[i] = uniques[ui++]!;
    }
    return { id, letters: result, hasDuplicate: true };
  }

  const letters: string[] = [];
  while (letters.length < 7) {
    const ch = LETTER_ALPHABET[pickInt(rng, 0, LETTER_ALPHABET.length - 1)]!;
    if (used.has(ch)) continue;
    used.add(ch);
    letters.push(ch);
  }
  return { id, letters, hasDuplicate: false };
}

/**
 * Build a seeded multitasking timeline long enough for `durationMs`.
 */
export function generateScalesMta(seed: number, durationMs = 5 * 60_000): MtaTimeline {
  const rng = createSeededRng(seed >>> 0);

  const aircraft: MtaAircraft[] = [];
  let offset = 500;
  let i = 0;
  while (offset < durationMs + MTA_FLIGHT_DURATION_MS) {
    aircraft.push({
      id: `ac-${i}`,
      startOffsetMs: offset,
      height:
        MTA_AIRCRAFT_HEIGHT_MIN +
        rng() * (MTA_AIRCRAFT_HEIGHT_MAX - MTA_AIRCRAFT_HEIGHT_MIN)
    });
    offset += MTA_AIRCRAFT_INTERVAL_MS;
    i += 1;
  }

  // Side tasks: enough for rapid answering throughout the session.
  const sideCount = Math.max(40, Math.ceil(durationMs / 2_000) + 20);
  const equations: MtaEquation[] = [];
  const letterChains: MtaLetterChain[] = [];
  for (let s = 0; s < sideCount; s++) {
    equations.push(generateEquation(rng, `eq-${s}`));
    letterChains.push(generateLetterChain(rng, `lt-${s}`));
  }

  return {
    kind: "scales_mta",
    seed,
    aircraft,
    equations,
    letterChains
  };
}

export function clampGateCenter(y: number): number {
  return Math.min(MTA_GATE_CENTER_MAX, Math.max(MTA_GATE_CENTER_MIN, y));
}

/** Progress 0–1 along the flight path; null if not yet started or already past. */
export function aircraftProgress(
  aircraft: MtaAircraft,
  offsetMs: number
): number | null {
  if (offsetMs < aircraft.startOffsetMs) return null;
  const elapsed = offsetMs - aircraft.startOffsetMs;
  if (elapsed > MTA_FLIGHT_DURATION_MS) return null;
  return elapsed / MTA_FLIGHT_DURATION_MS;
}

export function aircraftX(progress: number): number {
  return progress * MTA_RUNWAY_X;
}

/**
 * True when the aircraft's vertical extent overlaps the gray gate.
 * Uses interval overlap of [height ± AIRCRAFT_HALF] and [gate ± GATE_HALF].
 */
export function aircraftOverlapsGate(height: number, gateCenter: number): boolean {
  return Math.abs(height - gateCenter) <= MTA_GATE_HALF_HEIGHT + MTA_AIRCRAFT_HALF_HEIGHT;
}

export function isMtaExpired(session: MtaSession, now: number): boolean {
  return now - session.startedAt >= session.durationMs;
}

export function mtaRemainingMs(session: MtaSession, now: number): number {
  return Math.max(0, session.durationMs - (now - session.startedAt));
}

export function startMtaSession(
  timeline: MtaTimeline,
  minutes: number,
  now: number
): MtaSession {
  if (!(minutes > 0)) {
    throw new Error("Øktlengde må være et positivt antall minutter.");
  }
  if (timeline.aircraft.length === 0) {
    throw new Error("Tidslinjen har ingen fly.");
  }
  return {
    timeline,
    durationMs: Math.round(minutes * 60_000),
    startedAt: now,
    gateCenter: 0.5,
    aircraftJudgments: [],
    equationJudgments: [],
    letterJudgments: [],
    equationIndex: 0,
    letterIndex: 0,
    equationOpenedAt: now,
    letterOpenedAt: now,
    finished: false
  };
}

export type MtaActionResult =
  | { ok: true; session: MtaSession }
  | { ok: false; reason: "expired" | "finished" | "no_target" | "already_judged" };

/**
 * Move the gray landing gate. Positive delta moves down (toward 1).
 * Aircraft that have already arrived are judged against the current gate
 * before the move, so late ticks cannot change the outcome.
 * Rejected after expiry / finish.
 */
export function moveGate(
  session: MtaSession,
  delta: number,
  now: number
): MtaActionResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isMtaExpired(session, now)) return { ok: false, reason: "expired" };
  const resolved = resolveArrivedAircraft(session, now);
  return {
    ok: true,
    session: {
      ...resolved,
      gateCenter: clampGateCenter(resolved.gateCenter + delta)
    }
  };
}

/** Set the gate center absolutely (e.g. click on the runway bar). */
export function setGateCenter(
  session: MtaSession,
  y: number,
  now: number
): MtaActionResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isMtaExpired(session, now)) return { ok: false, reason: "expired" };
  const resolved = resolveArrivedAircraft(session, now);
  return {
    ok: true,
    session: {
      ...resolved,
      gateCenter: clampGateCenter(y)
    }
  };
}

function sessionOffset(session: MtaSession, now: number): number {
  return Math.max(0, now - session.startedAt);
}

function judgedAircraftIds(session: MtaSession): Set<string> {
  return new Set(session.aircraftJudgments.map((j) => j.aircraftId));
}

/** Active (in-flight, not yet judged) aircraft at this moment, if any. */
export function currentAircraft(
  session: MtaSession,
  now: number
): MtaAircraft | null {
  const offset = sessionOffset(session, now);
  const judged = judgedAircraftIds(session);
  for (const ac of session.timeline.aircraft) {
    if (judged.has(ac.id)) continue;
    const progress = aircraftProgress(ac, offset);
    if (progress != null) return ac;
  }
  return null;
}

export function currentEquation(session: MtaSession): MtaEquation | null {
  return session.timeline.equations[session.equationIndex] ?? null;
}

export function currentLetterChain(session: MtaSession): MtaLetterChain | null {
  return session.timeline.letterChains[session.letterIndex] ?? null;
}

/**
 * Judge aircraft that have reached the runway: overlap with the gate at
 * arrival → landed, otherwise miss. Uses the gate center in effect now
 * (callers that move the gate must resolve first).
 */
export function resolveArrivedAircraft(
  session: MtaSession,
  now: number
): MtaSession {
  if (session.finished) return session;
  const offset = sessionOffset(session, now);
  const judged = judgedAircraftIds(session);
  const extra: MtaAircraftJudgment[] = [];

  for (const ac of session.timeline.aircraft) {
    if (judged.has(ac.id)) continue;
    const end = ac.startOffsetMs + MTA_FLIGHT_DURATION_MS;
    if (offset >= end) {
      const landed = aircraftOverlapsGate(ac.height, session.gateCenter);
      extra.push({
        aircraftId: ac.id,
        outcome: landed ? "landed" : "miss",
        atOffsetMs: end,
        durationMs: MTA_FLIGHT_DURATION_MS
      });
    }
  }

  if (extra.length === 0) return session;
  return {
    ...session,
    aircraftJudgments: [...session.aircraftJudgments, ...extra]
  };
}

export function answerEquation(
  session: MtaSession,
  answer: MtaBinaryAnswer,
  now: number
): MtaActionResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isMtaExpired(session, now)) return { ok: false, reason: "expired" };

  const item = currentEquation(session);
  if (!item) return { ok: false, reason: "no_target" };

  const claimedCorrect = answer === "correct";
  const correct = claimedCorrect === item.isCorrect;
  const judgment: MtaSideJudgment = {
    itemId: item.id,
    answer,
    correct,
    durationMs: Math.max(0, now - session.equationOpenedAt)
  };

  return {
    ok: true,
    session: {
      ...session,
      equationJudgments: [...session.equationJudgments, judgment],
      equationIndex: session.equationIndex + 1,
      equationOpenedAt: now
    }
  };
}

export function answerLetters(
  session: MtaSession,
  answer: MtaBinaryAnswer,
  now: number
): MtaActionResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isMtaExpired(session, now)) return { ok: false, reason: "expired" };

  const item = currentLetterChain(session);
  if (!item) return { ok: false, reason: "no_target" };

  const claimedCorrect = answer === "correct";
  const correct = claimedCorrect === item.hasDuplicate;
  const judgment: MtaSideJudgment = {
    itemId: item.id,
    answer,
    correct,
    durationMs: Math.max(0, now - session.letterOpenedAt)
  };

  return {
    ok: true,
    session: {
      ...session,
      letterJudgments: [...session.letterJudgments, judgment],
      letterIndex: session.letterIndex + 1,
      letterOpenedAt: now
    }
  };
}

export function finishMtaSession(session: MtaSession, now: number): MtaSession {
  if (session.finished) return session;
  const resolved = resolveArrivedAircraft(session, now);
  return { ...resolved, finished: true };
}

export function buildMtaReport(session: MtaSession): MtaSessionReport {
  const landedCount = session.aircraftJudgments.filter((j) => j.outcome === "landed").length;
  const missCount = session.aircraftJudgments.filter((j) => j.outcome === "miss").length;
  const equationCorrect = session.equationJudgments.filter((j) => j.correct).length;
  const equationWrong = session.equationJudgments.filter((j) => !j.correct).length;
  const letterCorrect = session.letterJudgments.filter((j) => j.correct).length;
  const letterWrong = session.letterJudgments.filter((j) => !j.correct).length;

  return {
    kind: session.timeline.kind,
    seed: session.timeline.seed,
    landedCount,
    missCount,
    equationCorrect,
    equationWrong,
    letterCorrect,
    letterWrong,
    score:
      landedCount +
      (equationCorrect - equationWrong) +
      (letterCorrect - letterWrong),
    durationMs: session.durationMs,
    aircraftJudgments: session.aircraftJudgments,
    equationJudgments: session.equationJudgments,
    letterJudgments: session.letterJudgments
  };
}

/** Format equation as "8 + 4 + 7 + 5 = 24". */
export function formatMtaEquation(eq: MtaEquation): string {
  return `${eq.addends.join(" + ")} = ${eq.displayedSum}`;
}
