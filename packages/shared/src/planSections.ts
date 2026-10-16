import {
  questionCategories,
  questionCategoryLabels,
  type QuestionAudience,
  type QuestionCategory
} from "./interviewPrep.js";

/**
 * A slice of a prep plan the simulator can run on its own: one interviewer
 * question category.
 */
export const planSectionKeys = [...questionCategories] as const;
export type PlanSectionKey = (typeof planSectionKeys)[number];

export const planSectionLabels: Record<PlanSectionKey, string> = {
  ...questionCategoryLabels
};

export function isPlanSectionKey(value: string): value is PlanSectionKey {
  return (planSectionKeys as readonly string[]).includes(value);
}

export interface PlanSectionQuestion {
  category: QuestionCategory | string;
  audience?: QuestionAudience;
  included?: boolean;
  sortOrder?: number;
}

export interface PlanSection {
  key: PlanSectionKey;
  title: string;
  questionCount: number;
}

/** True when a question belongs to the section, ignoring whether it is included. */
export function questionInPlanSection(question: PlanSectionQuestion, key: PlanSectionKey): boolean {
  const audience = question.audience ?? "candidate";
  return audience === "candidate" && question.category === key;
}

/**
 * Sections with at least one included question, in the order the plan asks them.
 */
export function buildPlanSections(questions: PlanSectionQuestion[]): PlanSection[] {
  const included = [...questions]
    .filter((q) => q.included !== false)
    .filter((q) => (q.audience ?? "candidate") === "candidate")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const counts = new Map<PlanSectionKey, number>();
  for (const question of included) {
    const key = isPlanSectionKey(question.category) ? question.category : null;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, questionCount]) => ({
    key,
    title: planSectionLabels[key],
    questionCount
  }));
}
