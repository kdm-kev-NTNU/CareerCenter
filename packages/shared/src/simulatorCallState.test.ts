import { describe, expect, it } from "vitest";
import {
  phaseShowsCallStage,
  simulatorCallStates,
  transitionSimulatorCall,
  type SimulatorCallEvent,
  type SimulatorCallState
} from "./simulatorCallState.js";

const stagePhases: SimulatorCallState[] = ["connecting", "live", "finishing"];

const events: SimulatorCallEvent[] = [
  { type: "start" },
  { type: "connected" },
  { type: "failed" },
  { type: "leave" },
  { type: "end_tool" },
  { type: "feedback_ready" },
  { type: "restart" }
];

/** Expected next state for (state, event); missing = stay. */
const transitions: Partial<
  Record<SimulatorCallState, Partial<Record<SimulatorCallEvent["type"], SimulatorCallState>>>
> = {
  setup: { start: "connecting" },
  connecting: { connected: "live", failed: "setup" },
  live: { leave: "finishing", end_tool: "finishing" },
  finishing: { feedback_ready: "feedback" },
  feedback: { restart: "setup" }
};

describe("transitionSimulatorCall", () => {
  it.each(
    simulatorCallStates.flatMap((state) =>
      events.map((event) => {
        const expected = transitions[state]?.[event.type] ?? state;
        return [state, event.type, expected] as const;
      })
    )
  )("%s + %s → %s", (state, eventType, expected) => {
    expect(transitionSimulatorCall(state, { type: eventType })).toBe(expected);
  });
});

describe("phaseShowsCallStage", () => {
  it.each(simulatorCallStates.map((state) => [state, stagePhases.includes(state)] as const))(
    "%s → %s",
    (state, expected) => {
      expect(phaseShowsCallStage(state)).toBe(expected);
    }
  );

  it("never shows the stage in setup or feedback", () => {
    expect(phaseShowsCallStage("setup")).toBe(false);
    expect(phaseShowsCallStage("feedback")).toBe(false);
  });
});
