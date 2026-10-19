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
  | { type: "fail"; reason?: string }
  | { type: "cancel" }
  | { type: "resume_research" }
  | { type: "resume_answers" }
  | { type: "resume_curation" };

export const prepPlanPipelineSteps = [
  "created",
  "searching",
  "research_notes",
  "company_profile",
  "company_report",
  "clarifications",
  "awaiting_answers",
  "curating_questions",
  "ready"
] as const;
export type PrepPlanPipelineStep = (typeof prepPlanPipelineSteps)[number];

/** Pipeline steps that produce research artefacts and can be resumed mid-flight. */
export const researchPipelineSteps = [
  "created",
  "searching",
  "research_notes",
  "company_profile",
  "company_report",
  "clarifications"
] as const;
export type ResearchPipelineStep = (typeof researchPipelineSteps)[number];

export type PrepPlanResumePoint =
  | { kind: "research"; from: ResearchPipelineStep }
  | { kind: "awaiting_answers" }
  | { kind: "curation" };

/**
 * Where to resume a failed/cancelled plan without redoing finished work.
 * Invariant: clarificationRound >= 1 with step "clarifications" means round-2
 * generation failed after answers exist — resume to awaiting_answers, not research.
 */
export function prepPlanResumePoint(
  step: PrepPlanPipelineStep,
  clarificationRound: number
): PrepPlanResumePoint {
  if (step === "curating_questions" || step === "ready") {
    return { kind: "curation" };
  }
  if (step === "awaiting_answers") {
    return { kind: "awaiting_answers" };
  }
  if (step === "clarifications" && clarificationRound >= 1) {
    return { kind: "awaiting_answers" };
  }
  if ((researchPipelineSteps as readonly string[]).includes(step)) {
    return { kind: "research", from: step as ResearchPipelineStep };
  }
  return { kind: "research", from: "created" };
}

export type PrepPlanStepVisual = "done" | "active" | "pending" | "failed";

export function parsePrepPlanPipelineStep(value: string | null | undefined): PrepPlanPipelineStep {
  if (value && (prepPlanPipelineSteps as readonly string[]).includes(value)) {
    return value as PrepPlanPipelineStep;
  }
  return "created";
}

/**
 * Visual state of one pipeline step relative to the persisted current step.
 * Invariant: a later step is never "done" while an earlier step is still current,
 * and "ready" marks every step done.
 */
export function prepPlanStepVisual(
  step: PrepPlanPipelineStep,
  current: PrepPlanPipelineStep,
  status: PrepPlanStatus
): PrepPlanStepVisual {
  if (status === "ready") return "done";
  if (status === "failed" && step === current) return "failed";
  const stepIndex = prepPlanPipelineSteps.indexOf(step);
  const currentIndex = prepPlanPipelineSteps.indexOf(current);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

/** True while the server is still producing the next persisted plan state. */
export function isPrepPlanPipelineActive(step: PrepPlanPipelineStep, status: PrepPlanStatus): boolean {
  if (status === "failed" || status === "ready" || status === "draft" || status === "cancelled") {
    return false;
  }
  if (status === "researching" || status === "curating") return true;
  return (
    step === "searching" ||
    step === "research_notes" ||
    step === "company_profile" ||
    step === "company_report" ||
    step === "clarifications" ||
    step === "curating_questions"
  );
}

/** Statuses where an in-flight research/curation pipeline can be cancelled. */
export function canCancelPrepPlan(status: PrepPlanStatus): boolean {
  return status === "researching" || status === "curating";
}

/**
 * Statuses where a plan may be deleted. Research and curation write to the plan until they stop,
 * so those must be stopped first. The server also refuses while a job is still running.
 */
export function canDeletePrepPlan(status: PrepPlanStatus): boolean {
  return !canCancelPrepPlan(status);
}

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

  if (event.type === "cancel") {
    if (canCancelPrepPlan(status)) return "cancelled";
    return status;
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
    case "cancelled":
      if (event.type === "start_research" || event.type === "resume_research") return "researching";
      if (event.type === "resume_answers") return "awaiting_answers";
      if (event.type === "resume_curation") return "curating";
      break;
  }
  return status;
}

export function canStartSimulators(status: PrepPlanStatus): boolean {
  return status === "ready";
}
