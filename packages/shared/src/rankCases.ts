import type { CaseStyle } from "./interviewPrep.js";

export interface CaseRankProfile {
  industries: string[];
  caseTypes: string[];
  style?: CaseStyle;
  /** Desired overall difficulty 1-3 */
  targetDifficulty?: number;
  round?: number;
}

export interface RankableCase {
  id: string;
  industry?: string | null;
  caseType?: string | null;
  style?: CaseStyle | null;
  difficultyOverall?: number | null;
  round?: number | null;
}

/**
 * Deterministic ranking of cases for a company profile.
 * Higher score = better fit. Stable sort by score desc then id asc.
 */
export function rankCasesForCompany(profile: CaseRankProfile, cases: RankableCase[]): RankableCase[] {
  const scored = cases.map((c) => ({ case: c, score: scoreCase(profile, c) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.case.id.localeCompare(b.case.id);
  });
  return scored.map((s) => s.case);
}

function scoreCase(profile: CaseRankProfile, c: RankableCase): number {
  let score = 0;
  if (c.industry && profile.industries.some((i) => i.toLowerCase() === c.industry!.toLowerCase())) {
    score += 40;
  }
  if (c.caseType && profile.caseTypes.some((t) => t.toLowerCase() === c.caseType!.toLowerCase())) {
    score += 30;
  }
  if (profile.style && c.style === profile.style) score += 15;
  if (profile.targetDifficulty != null && c.difficultyOverall != null) {
    const diff = Math.abs(profile.targetDifficulty - c.difficultyOverall);
    score += Math.max(0, 10 - diff * 4);
  }
  if (profile.round != null && c.round != null && profile.round === c.round) score += 5;
  return score;
}
