import type { PuzzleAbilityTestKind } from "./abilityTests.js";
import {
  generateSwitchChallenge,
  isCorrectSwitchAnswer,
  type SwitchAnswer,
  type SwitchChallengePuzzle
} from "./switchChallenge.js";
import {
  generateScalesClx,
  isCorrectClxSelection,
  type ScalesClxPuzzle
} from "./scalesClx.js";

export type AbilityPuzzle = SwitchChallengePuzzle | ScalesClxPuzzle;

export type AbilityAnswer = SwitchAnswer | number[];

export interface AbilitySessionItem {
  seed: number;
  level: number;
  puzzle: AbilityPuzzle;
  answer: AbilityAnswer | null;
  correct: boolean | null;
  durationMs: number;
  startedAt: number;
}

export interface AbilitySession {
  kind: PuzzleAbilityTestKind;
  durationMs: number;
  startedAt: number;
  /** Current adaptive level (Switch only; Scales stays at 1). */
  level: number;
  /** Highest level reached during the session (includes current). */
  peakLevel: number;
  items: AbilitySessionItem[];
  /** Index of the open (unanswered) item, or null when none. */
  currentIndex: number | null;
  finished: boolean;
}

export interface AbilitySessionReport {
  kind: PuzzleAbilityTestKind;
  correctCount: number;
  wrongCount: number;
  answeredCount: number;
  peakLevel: number;
  durationMs: number;
  items: AbilitySessionItem[];
}

function newSeed(now: number, ordinal: number): number {
  return Math.floor((now + ordinal * 7919) % 1_000_000_000);
}

function makePuzzle(kind: PuzzleAbilityTestKind, seed: number, level: number): AbilityPuzzle {
  if (kind === "switch_challenge") {
    return generateSwitchChallenge(seed, level);
  }
  return generateScalesClx(seed);
}

function isAnswerCorrect(
  kind: PuzzleAbilityTestKind,
  puzzle: AbilityPuzzle,
  answer: AbilityAnswer
): boolean {
  if (kind === "switch_challenge") {
    return isCorrectSwitchAnswer(puzzle as SwitchChallengePuzzle, answer as SwitchAnswer);
  }
  return isCorrectClxSelection(puzzle as ScalesClxPuzzle, answer as number[]);
}

function openItem(session: AbilitySession, now: number): AbilitySessionItem {
  const seed = newSeed(now, session.items.length);
  return {
    seed,
    level: session.level,
    puzzle: makePuzzle(session.kind, seed, session.level),
    answer: null,
    correct: null,
    durationMs: 0,
    startedAt: now
  };
}

export function isExpired(session: AbilitySession, now: number): boolean {
  return now - session.startedAt >= session.durationMs;
}

export function remainingMs(session: AbilitySession, now: number): number {
  return Math.max(0, session.durationMs - (now - session.startedAt));
}

/**
 * Start a timed ability session and open the first puzzle.
 * `minutes` must be a positive number; duration is minutes × 60_000.
 */
export function startSession(
  kind: PuzzleAbilityTestKind,
  minutes: number,
  now: number
): AbilitySession {
  if (!(minutes > 0)) {
    throw new Error("Øktlengde må være et positivt antall minutter.");
  }
  const session: AbilitySession = {
    kind,
    durationMs: Math.round(minutes * 60_000),
    startedAt: now,
    level: 1,
    peakLevel: 1,
    items: [],
    currentIndex: null,
    finished: false
  };
  const first = openItem(session, now);
  return {
    ...session,
    items: [first],
    currentIndex: 0
  };
}

export type RecordAnswerResult =
  | { ok: true; session: AbilitySession }
  | { ok: false; reason: "expired" | "finished" | "no_current" | "already_answered" };

/**
 * Record an answer for the current open item.
 * On success: marks the item, advances Switch level on correct (stays on wrong),
 * and opens the next puzzle unless the session is expired/finished.
 */
export function recordAnswer(
  session: AbilitySession,
  answer: AbilityAnswer,
  now: number
): RecordAnswerResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isExpired(session, now)) return { ok: false, reason: "expired" };
  if (session.currentIndex == null) return { ok: false, reason: "no_current" };

  const idx = session.currentIndex;
  const current = session.items[idx];
  if (!current) return { ok: false, reason: "no_current" };
  if (current.answer != null) return { ok: false, reason: "already_answered" };

  const correct = isAnswerCorrect(session.kind, current.puzzle, answer);
  const answered: AbilitySessionItem = {
    ...current,
    answer,
    correct,
    durationMs: Math.max(0, now - current.startedAt)
  };

  let nextLevel = session.level;
  if (session.kind === "switch_challenge" && correct) {
    nextLevel = session.level + 1;
  }
  const peakLevel = Math.max(session.peakLevel, nextLevel);

  const items = session.items.map((item, i) => (i === idx ? answered : item));
  let next: AbilitySession = {
    ...session,
    level: nextLevel,
    peakLevel,
    items,
    currentIndex: null
  };

  // Open next puzzle if time remains.
  if (!isExpired(next, now)) {
    const following = openItem(next, now);
    next = {
      ...next,
      items: [...next.items, following],
      currentIndex: next.items.length
    };
  } else {
    next = { ...next, finished: true };
  }

  return { ok: true, session: next };
}

/** End the session early (or on timeout). Leaves unanswered current item unanswered. */
export function finishSession(session: AbilitySession): AbilitySession {
  if (session.finished) return session;
  return { ...session, finished: true, currentIndex: null };
}

export function buildSessionReport(session: AbilitySession): AbilitySessionReport {
  const answered = session.items.filter((item) => item.correct != null);
  const correctCount = answered.filter((item) => item.correct === true).length;
  const wrongCount = answered.filter((item) => item.correct === false).length;
  return {
    kind: session.kind,
    correctCount,
    wrongCount,
    answeredCount: answered.length,
    peakLevel: session.peakLevel,
    durationMs: session.durationMs,
    items: answered
  };
}

export function currentPuzzle(session: AbilitySession): AbilityPuzzle | null {
  if (session.currentIndex == null) return null;
  return session.items[session.currentIndex]?.puzzle ?? null;
}
