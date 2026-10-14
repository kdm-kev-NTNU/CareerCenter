import { describe, expect, it } from "vitest";
import {
  phaseNeedsCamera,
  phaseRevealsPrompt,
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
