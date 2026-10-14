import type { StarRubricCriterion } from "./interviewPrep.js";
import { starRubricCriteria } from "./interviewPrep.js";

export interface StoryScoreSnapshot {
  scores: Record<StarRubricCriterion, number>;
  sum: number;
  createdAt: string;
}

export interface StoryWithScores {
  id: string;
  title: string;
  tags: string[];
  latestSum?: number;
  averageSum?: number;
  scoreHistory: StoryScoreSnapshot[];
}

/** Lower average sum = weaker story — practice these first. */
export function weakestStoryQueue(stories: StoryWithScores[]): StoryWithScores[] {
  return [...stories].sort((a, b) => {
    const aScore = a.averageSum ?? a.latestSum ?? 999;
    const bScore = b.averageSum ?? b.latestSum ?? 999;
    if (aScore !== bScore) return aScore - bScore;
    return a.title.localeCompare(b.title, "nb");
  });
}

export function averageStarSum(history: StoryScoreSnapshot[]): number | undefined {
  if (!history.length) return undefined;
  const total = history.reduce((acc, item) => acc + item.sum, 0);
  return Math.round((total / history.length) * 10) / 10;
}

export interface AnkiStoryRow {
  front: string;
  back: string;
  tags?: string[];
}

export function storyToAnkiRow(input: {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
}): AnkiStoryRow {
  const front = input.title.trim() || "STAR-historie";
  const sections = [
    ["S", input.situation],
    ["T", input.task],
    ["A", input.action],
    ["R", input.result]
  ]
    .filter(([, text]) => text.trim())
    .map(([label, text]) => `${label}: ${text.trim()}`)
    .join("\n\n");
  return {
    front,
    back: sections || "(tom historie)",
    tags: ["interview-mecca", "star", ...input.tags]
  };
}

export function storiesToAnkiCsv(rows: AnkiStoryRow[]): string {
  const escape = (value: string) => {
    const needsQuote = /[",\n\r]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  };
  const header = "Front,Back,Tags";
  const lines = rows.map((row) => {
    const tags = (row.tags ?? []).join(" ");
    return [escape(row.front), escape(row.back), escape(tags)].join(",");
  });
  return [header, ...lines].join("\r\n");
}

export function emptyStarScores(): Record<StarRubricCriterion, number> {
  return Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
    StarRubricCriterion,
    number
  >;
}
