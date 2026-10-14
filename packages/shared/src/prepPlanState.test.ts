import { describe, expect, it } from "vitest";
import {
  canStartSimulators,
  isPrepPlanPipelineActive,
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

  it("cannot skip clarification to ready", () => {
    const s = transitionPrepPlan("researching", { type: "curation_done" });
    expect(s).toBe("researching");
    expect(canStartSimulators(s)).toBe(false);
  });

  it("fails from running states", () => {
    expect(transitionPrepPlan("researching", { type: "fail" })).toBe("failed");
  });

  it("marks earlier pipeline steps done and later steps pending", () => {
    expect(prepPlanStepVisual("created", "research_notes", "researching")).toBe("done");
    expect(prepPlanStepVisual("research_notes", "research_notes", "researching")).toBe("active");
    expect(prepPlanStepVisual("company_profile", "research_notes", "researching")).toBe("pending");
    expect(prepPlanStepVisual("searching", "searching", "failed")).toBe("failed");
    expect(prepPlanStepVisual("created", "ready", "ready")).toBe("done");
    expect(prepPlanStepVisual("ready", "ready", "ready")).toBe("done");
    expect(isPrepPlanPipelineActive("searching", "researching")).toBe(true);
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
