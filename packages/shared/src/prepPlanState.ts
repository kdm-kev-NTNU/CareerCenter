import type { PrepPlanStatus } from "./interviewPrep.js";

export type PrepPlanEvent =
  | { type: "start_research" }
  | { type: "research_needs_answers" }
  | { type: "research_failed"; reason?: string }
  | { type: "answers_submitted" }
  | { type: "curation_done" }
  | { type: "curation_failed"; reason?: string }
  | { type: "fail"; reason?: string };

/**
 * Pure state machine for prep plans.
 * Invariant: cannot reach "ready" without passing awaiting_answers resolution
 * (either via research_needs_answers → answers_submitted → curating → ready,
 * or research that goes straight to curating is not allowed — gaps always pause).
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
      if (event.type === "answers_submitted") return "curating";
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
