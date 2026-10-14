import { describe, expect, it } from "vitest";
import { prepPlanPipelineSteps, prepPlanStatuses, videoSimStates } from "@careercenter/shared";
import {
  prepPlanPipelineStepLabel,
  prepPlanStatusTone,
  toneForPrepPlanStatus,
  toneForVideoPhase,
  videoPhaseTone
} from "./statusTone.js";

describe("statusTone", () => {
  it("maps every prep plan status to a tone", () => {
    for (const status of prepPlanStatuses) {
      const tone = toneForPrepPlanStatus(status);
      expect(tone.label.length).toBeGreaterThan(0);
      expect(["accent", "muted", "blue", "danger"]).toContain(tone.variant);
      expect(prepPlanStatusTone[status]).toEqual(tone);
    }
  });

  it("labels every prep plan pipeline step", () => {
    for (const step of prepPlanPipelineSteps) {
      expect(prepPlanPipelineStepLabel[step].length).toBeGreaterThan(0);
    }
  });

  it("maps every video phase to a tone", () => {
    for (const phase of videoSimStates) {
      const tone = toneForVideoPhase(phase);
      expect(tone.label.length).toBeGreaterThan(0);
      expect(["accent", "muted", "blue", "danger"]).toContain(tone.variant);
      expect(videoPhaseTone[phase]).toEqual(tone);
    }
  });
});
