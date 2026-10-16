import {
  questionCategories,
  questionCategoryLabels,
  type QuestionAudience,
  type QuestionCategory
} from "./interviewPrep.js";

/**
 * A slice of a prep plan the simulator can run on its own: one interviewer
 * question category, or the closing round where the candidate asks.
 */
export const planSectionKeys = [...questionCategories, "ask_interviewer"] as const;
export type PlanSectionKey = (typeof planSectionKeys)[number];

export const ASK_INTERVIEWER_SECTION = "ask_interviewer" satisfies PlanSectionKey;

export const planSectionLabels: Record<PlanSectionKey, string> = {
  ...questionCategoryLabels,
  ask_interviewer: "Spørsmålsrunde (jeg spør)"
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
  if (key === ASK_INTERVIEWER_SECTION) return audience !== "candidate";
  return audience === "candidate" && question.category === key;
}

/**
 * Sections with at least one included question, in the order the plan asks them.
 * The closing round always comes last, as in a real interview.
 */
export function buildPlanSections(questions: PlanSectionQuestion[]): PlanSection[] {
  const included = [...questions]
    .filter((q) => q.included !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const counts = new Map<PlanSectionKey, number>();
  for (const question of included) {
    const audience = question.audience ?? "candidate";
    const key: PlanSectionKey | null =
      audience !== "candidate"
        ? ASK_INTERVIEWER_SECTION
        : isPlanSectionKey(question.category)
          ? question.category
          : null;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const askCount = counts.get(ASK_INTERVIEWER_SECTION);
  counts.delete(ASK_INTERVIEWER_SECTION);
  const sections = [...counts].map(([key, questionCount]) => ({
    key,
    title: planSectionLabels[key],
    questionCount
  }));
  if (askCount) {
    sections.push({
      key: ASK_INTERVIEWER_SECTION,
      title: planSectionLabels[ASK_INTERVIEWER_SECTION],
      questionCount: askCount
    });
  }
  return sections;
}
