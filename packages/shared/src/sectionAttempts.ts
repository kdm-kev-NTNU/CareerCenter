import type { InterviewSessionDto } from "./interviewPrepDtos.js";
import type { PlanSectionKey } from "./planSections.js";

/** Section key for a full-interview attempt (no `planSection` on the session). */
export type SectionKey = PlanSectionKey | "full";

export interface SectionAttempt {
  /** 1-based attempt number within the same plan section. */
  version: number;
  session: InterviewSessionDto;
  sum: number | undefined;
  /** Difference in sum from the previous finished attempt; undefined for v1 or missing scores. */
  deltaFromPrevious: number | undefined;
}

function sectionKeyOf(session: InterviewSessionDto): SectionKey {
  return session.planSection ?? "full";
}

function compareFinished(a: InterviewSessionDto, b: InterviewSessionDto): number {
  const aAt = a.finishedAt ?? "";
  const bAt = b.finishedAt ?? "";
  if (aAt !== bAt) return aAt < bAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Groups finished sessions by section and assigns stable version numbers.
 * Incomplete sessions (no `finishedAt`) are skipped. Ordering is by
 * `finishedAt` ascending with `id` as tie-breaker so the same attempt always
 * gets the same version regardless of list order.
 */
export function buildSectionAttemptHistory(
  sessions: readonly InterviewSessionDto[]
): ReadonlyMap<SectionKey, readonly SectionAttempt[]> {
  const bySection = new Map<SectionKey, InterviewSessionDto[]>();
  for (const session of sessions) {
    if (!session.finishedAt) continue;
    const key = sectionKeyOf(session);
    const list = bySection.get(key);
    if (list) list.push(session);
    else bySection.set(key, [session]);
  }

  const result = new Map<SectionKey, readonly SectionAttempt[]>();
  for (const [key, list] of bySection) {
    list.sort(compareFinished);
    const attempts: SectionAttempt[] = list.map((session, index) => {
      const sum = session.feedback?.sum;
      const previousSum = index > 0 ? list[index - 1]?.feedback?.sum : undefined;
      const deltaFromPrevious =
        sum !== undefined && previousSum !== undefined ? sum - previousSum : undefined;
      return {
        version: index + 1,
        session,
        sum,
        deltaFromPrevious
      };
    });
    result.set(key, attempts);
  }
  return result;
}

/** Latest finished attempt for a section, or undefined if none. */
export function latestSectionAttempt(
  history: ReadonlyMap<SectionKey, readonly SectionAttempt[]>,
  key: SectionKey
): SectionAttempt | undefined {
  const attempts = history.get(key);
  if (!attempts || attempts.length === 0) return undefined;
  return attempts[attempts.length - 1];
}
