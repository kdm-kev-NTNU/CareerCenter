import { describe, expect, it } from "vitest";
import {
  modeUsesAi,
  phaseNeedsCamera,
  phaseRevealsPrompt,
  practiceModes,
  videoSimStates,
  type VideoSimState
} from "./videoSimState.js";

const cameraPhases: VideoSimState[] = ["device_check", "recording"];
const promptPhases: VideoSimState[] = ["thinking", "recording", "review"];

describe("phaseNeedsCamera", () => {
  it.each(videoSimStates.map((state) => [state, cameraPhases.includes(state)] as const))(
    "%s → %s",
    (state, expected) => {
      expect(phaseNeedsCamera(state)).toBe(expected);
    }
  );
});

describe("phaseRevealsPrompt", () => {
  it.each(videoSimStates.map((state) => [state, promptPhases.includes(state)] as const))(
    "%s → %s",
    (state, expected) => {
      expect(phaseRevealsPrompt(state)).toBe(expected);
    }
  );
});

describe("modeUsesAi", () => {
  it("is false for practice and true for scored", () => {
    expect(modeUsesAi("practice")).toBe(false);
    expect(modeUsesAi("scored")).toBe(true);
  });

  it("covers every practice mode", () => {
    expect(practiceModes).toEqual(["practice", "scored"]);
    for (const mode of practiceModes) {
      expect(typeof modeUsesAi(mode)).toBe("boolean");
    }
  });
});
