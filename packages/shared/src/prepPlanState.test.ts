import { describe, expect, it } from "vitest";
import {
  canDeletePrepPlan,
  canStartSimulators,
  isPrepPlanPipelineActive,
  parsePrepPlanPipelineStep,
  prepPlanResumePoint,
  prepPlanStepVisual,
  transitionPrepPlan
} from "./prepPlanState.js";
import { rankCasesForCompany } from "./rankCases.js";
import { transitionVideoSim, canStartRecording } from "./videoSimState.js";

describe("transitionPrepPlan", () => {
  it("follows the happy path", () => {
    let s = transitionPrepPlan("draft", { type: "start_research" });
    expect(s).toBe("researching");
    s = transitionPrepPlan(s, { type: "research_needs_answers" });
    expect(s).toBe("awaiting_answers");
    s = transitionPrepPlan(s, { type: "answers_submitted" });
    expect(s).toBe("curating");
    s = transitionPrepPlan(s, { type: "curation_done" });
    expect(s).toBe("ready");
    expect(canStartSimulators(s)).toBe(true);
  });

  it("only allows deleting a plan when no research or curation is running", () => {
    expect(canDeletePrepPlan("researching")).toBe(false);
    expect(canDeletePrepPlan("curating")).toBe(false);
    for (const status of ["draft", "awaiting_answers", "ready", "failed", "cancelled"] as const) {
      expect(canDeletePrepPlan(status)).toBe(true);
    }
  });

  it("cannot skip clarification to ready", () => {
    const s = transitionPrepPlan("researching", { type: "curation_done" });
    expect(s).toBe("researching");
    expect(canStartSimulators(s)).toBe(false);
  });

  it("fails from running states", () => {
    expect(transitionPrepPlan("researching", { type: "fail" })).toBe("failed");
  });

  it("cancels researching and curating, and can restart from cancelled", () => {
    expect(transitionPrepPlan("researching", { type: "cancel" })).toBe("cancelled");
    expect(transitionPrepPlan("curating", { type: "cancel" })).toBe("cancelled");
    expect(transitionPrepPlan("awaiting_answers", { type: "cancel" })).toBe("awaiting_answers");
    expect(transitionPrepPlan("cancelled", { type: "start_research" })).toBe("researching");
    expect(isPrepPlanPipelineActive("searching", "cancelled")).toBe(false);
  });

  it("resumes from failed/cancelled to the right status", () => {
    expect(transitionPrepPlan("failed", { type: "resume_research" })).toBe("researching");
    expect(transitionPrepPlan("failed", { type: "resume_answers" })).toBe("awaiting_answers");
    expect(transitionPrepPlan("failed", { type: "resume_curation" })).toBe("curating");
    expect(transitionPrepPlan("cancelled", { type: "resume_curation" })).toBe("curating");
    expect(transitionPrepPlan("ready", { type: "resume_research" })).toBe("ready");
    expect(transitionPrepPlan("draft", { type: "resume_answers" })).toBe("draft");
  });

  it("maps pipeline step to resume point without overwriting answered clarifications", () => {
    expect(prepPlanResumePoint("searching", 0)).toEqual({ kind: "research", from: "searching" });
    expect(prepPlanResumePoint("research_notes", 0)).toEqual({ kind: "research", from: "research_notes" });
    expect(prepPlanResumePoint("company_profile", 0)).toEqual({ kind: "research", from: "company_profile" });
    expect(prepPlanResumePoint("clarifications", 0)).toEqual({ kind: "research", from: "clarifications" });
    expect(prepPlanResumePoint("clarifications", 1)).toEqual({ kind: "awaiting_answers" });
    expect(prepPlanResumePoint("clarifications", 2)).toEqual({ kind: "awaiting_answers" });
    expect(prepPlanResumePoint("awaiting_answers", 1)).toEqual({ kind: "awaiting_answers" });
    expect(prepPlanResumePoint("curating_questions", 1)).toEqual({ kind: "curation" });
    expect(prepPlanResumePoint("drafting_answers", 1)).toEqual({ kind: "answers" });
    expect(prepPlanResumePoint("created", 0)).toEqual({ kind: "research", from: "created" });
  });

  it("maps legacy company_report to clarifications", () => {
    expect(parsePrepPlanPipelineStep("company_report")).toBe("clarifications");
    expect(parsePrepPlanPipelineStep("drafting_answers")).toBe("drafting_answers");
    expect(parsePrepPlanPipelineStep("unknown_step")).toBe("created");
  });

  it("marks earlier pipeline steps done and later steps pending", () => {
    expect(prepPlanStepVisual("created", "research_notes", "researching")).toBe("done");
    expect(prepPlanStepVisual("research_notes", "research_notes", "researching")).toBe("active");
    expect(prepPlanStepVisual("company_profile", "research_notes", "researching")).toBe("pending");
    expect(prepPlanStepVisual("clarifications", "company_profile", "researching")).toBe("pending");
    expect(prepPlanStepVisual("searching", "searching", "failed")).toBe("failed");
    expect(prepPlanStepVisual("created", "ready", "ready")).toBe("done");
    expect(prepPlanStepVisual("ready", "ready", "ready")).toBe("done");
    expect(isPrepPlanPipelineActive("searching", "researching")).toBe(true);
    expect(isPrepPlanPipelineActive("drafting_answers", "curating")).toBe(true);
    expect(isPrepPlanPipelineActive("awaiting_answers", "awaiting_answers")).toBe(false);
    expect(isPrepPlanPipelineActive("clarifications", "awaiting_answers")).toBe(true);
    expect(isPrepPlanPipelineActive("ready", "ready")).toBe(false);
  });
});

describe("rankCasesForCompany", () => {
  it("is deterministic and prefers industry+type match", () => {
    const profile = {
      industries: ["Healthcare"],
      caseTypes: ["profitability"],
      style: "candidate_led" as const,
      targetDifficulty: 2
    };
    const cases = [
      { id: "b", industry: "Retail", caseType: "growth", difficultyOverall: 3 },
      { id: "a", industry: "Healthcare", caseType: "profitability", style: "candidate_led" as const, difficultyOverall: 2 },
      { id: "c", industry: "Healthcare", caseType: "m&a", difficultyOverall: 1 }
    ];
    const ranked = rankCasesForCompany(profile, cases);
    expect(ranked.map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(rankCasesForCompany(profile, cases)).toEqual(ranked);
  });
});

describe("transitionVideoSim", () => {
  it("cannot start recording before think elapsed", () => {
    let s = transitionVideoSim("setup", { type: "settings_confirmed" });
    s = transitionVideoSim(s, { type: "devices_ready" });
    s = transitionVideoSim(s, { type: "card_selected" });
    expect(s).toBe("thinking");
    expect(canStartRecording(s)).toBe(false);
    // Attempting stop_recording while thinking must not jump to recording
    expect(transitionVideoSim(s, { type: "stop_recording" })).toBe("thinking");
    s = transitionVideoSim(s, { type: "think_elapsed" });
    expect(s).toBe("recording");
    expect(canStartRecording(s)).toBe(true);
  });
});
