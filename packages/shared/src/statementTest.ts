import type { StatementAbilityTestKind } from "./abilityTests.js";

export type StatementVerdict = "true" | "false" | "cannot_say";

export interface TableSheet {
  id: string;
  title: string;
  kind: "table";
  /** Unit label shown under the table, e.g. "tusen USD". */
  unitLabel: string;
  /** Multiplier from displayed cell values to absolute units (e.g. 1000). */
  unitMultiplier: number;
  columns: string[];
  rows: Array<{ label: string; values: number[] }>;
}

export interface PieSlice {
  label: string;
  percent: number;
}

export interface PieSheet {
  id: string;
  title: string;
  kind: "pie";
  /** Absolute total that percentages apply to. */
  total: number;
  totalUnitLabel: string;
  slices: PieSlice[];
}

export interface BarSeries {
  label: string;
  values: number[];
}

export interface BarSheet {
  id: string;
  title: string;
  kind: "bar";
  unitLabel: string;
  unitMultiplier: number;
  categories: string[];
  series: BarSeries[];
}

export interface PassageSheet {
  id: string;
  title: string;
  kind: "passage";
  text: string;
}

export type DataSheet = TableSheet | PieSheet | BarSheet | PassageSheet;

export interface StatementItem {
  id: string;
  sheetId: string;
  text: string;
  verdict: StatementVerdict;
  rationale: string;
}

export interface StatementTest {
  kind: StatementAbilityTestKind;
  seed: number;
  sheets: DataSheet[];
  statements: StatementItem[];
}

export interface StatementSession {
  test: StatementTest;
  durationMs: number;
  startedAt: number;
  /** Index → verdict for answered statements. */
  answers: Record<string, StatementVerdict>;
  /** Statement id → ms spent on that statement (last open window). */
  timeSpentMs: Record<string, number>;
  currentStatementIndex: number;
  finished: boolean;
}

export interface StatementReportItem {
  statement: StatementItem;
  answer: StatementVerdict | null;
  correct: boolean | null;
  durationMs: number;
}

export interface StatementSessionReport {
  kind: StatementAbilityTestKind;
  seed: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  answeredCount: number;
  /** +1 per correct, −1 per wrong (Aon-style). */
  score: number;
  durationMs: number;
  items: StatementReportItem[];
}

export function isStatementExpired(session: StatementSession, now: number): boolean {
  return now - session.startedAt >= session.durationMs;
}

export function statementRemainingMs(session: StatementSession, now: number): number {
  return Math.max(0, session.durationMs - (now - session.startedAt));
}

/**
 * Start a timed statement session. `minutes` must be positive.
 */
export function startStatementSession(
  test: StatementTest,
  minutes: number,
  now: number
): StatementSession {
  if (!(minutes > 0)) {
    throw new Error("Øktlengde må være et positivt antall minutter.");
  }
  if (test.statements.length === 0) {
    throw new Error("Testen har ingen påstander.");
  }
  return {
    test,
    durationMs: Math.round(minutes * 60_000),
    startedAt: now,
    answers: {},
    timeSpentMs: {},
    currentStatementIndex: 0,
    finished: false
  };
}

export type AnswerStatementResult =
  | { ok: true; session: StatementSession }
  | { ok: false; reason: "expired" | "finished" | "unknown_statement" };

/**
 * Record or change an answer. Allowed until the session expires or is finished.
 */
export function answerStatement(
  session: StatementSession,
  statementId: string,
  verdict: StatementVerdict,
  now: number
): AnswerStatementResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isStatementExpired(session, now)) return { ok: false, reason: "expired" };
  const exists = session.test.statements.some((s) => s.id === statementId);
  if (!exists) return { ok: false, reason: "unknown_statement" };

  return {
    ok: true,
    session: {
      ...session,
      answers: { ...session.answers, [statementId]: verdict }
    }
  };
}

export type NavigateStatementResult =
  | { ok: true; session: StatementSession }
  | { ok: false; reason: "expired" | "finished" | "out_of_range" };

/**
 * Move focus to another statement. Tracks open time on the previous statement.
 */
export function navigateStatement(
  session: StatementSession,
  nextIndex: number,
  now: number,
  openStartedAt: number
): NavigateStatementResult {
  if (session.finished) return { ok: false, reason: "finished" };
  if (isStatementExpired(session, now)) return { ok: false, reason: "expired" };
  if (nextIndex < 0 || nextIndex >= session.test.statements.length) {
    return { ok: false, reason: "out_of_range" };
  }

  const current = session.test.statements[session.currentStatementIndex];
  let timeSpentMs = session.timeSpentMs;
  if (current) {
    const delta = Math.max(0, now - openStartedAt);
    timeSpentMs = {
      ...timeSpentMs,
      [current.id]: (timeSpentMs[current.id] ?? 0) + delta
    };
  }

  return {
    ok: true,
    session: {
      ...session,
      timeSpentMs,
      currentStatementIndex: nextIndex
    }
  };
}

/** End the session early (or on timeout). */
export function finishStatementSession(
  session: StatementSession,
  now?: number,
  openStartedAt?: number
): StatementSession {
  if (session.finished) return session;
  let timeSpentMs = session.timeSpentMs;
  if (now != null && openStartedAt != null) {
    const current = session.test.statements[session.currentStatementIndex];
    if (current) {
      const delta = Math.max(0, now - openStartedAt);
      timeSpentMs = {
        ...timeSpentMs,
        [current.id]: (timeSpentMs[current.id] ?? 0) + delta
      };
    }
  }
  return { ...session, finished: true, timeSpentMs };
}

export function buildStatementReport(session: StatementSession): StatementSessionReport {
  const items: StatementReportItem[] = session.test.statements.map((statement) => {
    const answer = session.answers[statement.id] ?? null;
    const correct = answer == null ? null : answer === statement.verdict;
    return {
      statement,
      answer,
      correct,
      durationMs: session.timeSpentMs[statement.id] ?? 0
    };
  });
  const answered = items.filter((i) => i.correct != null);
  const correctCount = answered.filter((i) => i.correct === true).length;
  const wrongCount = answered.filter((i) => i.correct === false).length;
  return {
    kind: session.test.kind,
    seed: session.test.seed,
    correctCount,
    wrongCount,
    unansweredCount: items.length - answered.length,
    answeredCount: answered.length,
    score: correctCount - wrongCount,
    durationMs: session.durationMs,
    items
  };
}

export function currentStatement(session: StatementSession): StatementItem | null {
  return session.test.statements[session.currentStatementIndex] ?? null;
}

export function sheetForStatement(
  test: StatementTest,
  statement: StatementItem
): DataSheet | null {
  return test.sheets.find((s) => s.id === statement.sheetId) ?? null;
}

export const VERDICT_LABELS: Record<StatementVerdict, string> = {
  true: "Sant",
  false: "Usant",
  cannot_say: "Kan ikke avgjøres"
};
