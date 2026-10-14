import type { PrepPlanStatus } from "./interviewPrep.js";

export type PrepPlanEvent =
  | { type: "start_research" }
  | { type: "research_needs_answers" }
  | { type: "research_failed"; reason?: string }
  | { type: "answers_submitted" }
  | { type: "clarifications_skipped" }
  | { type: "more_clarifications" }
  | { type: "curation_done" }
  | { type: "curation_failed"; reason?: string }
  | { type: "fail"; reason?: string };

export const MAX_CLARIFICATION_ROUNDS = 2;
export const MAX_CLARIFICATIONS_PER_ROUND = 5;
export const MIN_CURATED_QUESTIONS = 30;
export const MAX_CURATED_QUESTIONS = 50;

/**
 * Pure state machine for prep plans.
 * Invariant: cannot reach "ready" without resolving awaiting_answers
 * (answers_submitted or clarifications_skipped → curating → ready).
 * Max clarification rounds is enforced by the service, not this machine.
 */
export function transitionPrepPlan(status: PrepPlanStatus, event: PrepPlanEvent): PrepPlanStatus {
  if (event.type === "fail" || event.type === "research_failed" || event.type === "curation_failed") {
    if (status === "ready") return status;
    return "failed";
  }

  switch (status) {
    case "draft":
      if (event.type === "start_research") return "researching";
      break;
    case "researching":
      if (event.type === "research_needs_answers") return "awaiting_answers";
      break;
    case "awaiting_answers":
      if (event.type === "answers_submitted" || event.type === "clarifications_skipped") {
        return "curating";
      }
      if (event.type === "more_clarifications") return "awaiting_answers";
      break;
    case "curating":
      if (event.type === "curation_done") return "ready";
      break;
    case "ready":
      break;
    case "failed":
      if (event.type === "start_research") return "researching";
      break;
  }
  return status;
}

export function canStartSimulators(status: PrepPlanStatus): boolean {
  return status === "ready";
}
