export const simulatorCallStates = [
  "setup",
  "connecting",
  "live",
  "finishing",
  "feedback"
] as const;
export type SimulatorCallState = (typeof simulatorCallStates)[number];

export type SimulatorCallEvent =
  | { type: "start" }
  | { type: "connected" }
  | { type: "failed" }
  | { type: "leave" }
  | { type: "end_tool" }
  | { type: "feedback_ready" }
  | { type: "restart" };

/**
 * Pure interview-simulator call lifecycle.
 * Invariant: the Teams-style stage is only legal while a call exists
 * (connecting | live | finishing).
 */
export function transitionSimulatorCall(
  state: SimulatorCallState,
  event: SimulatorCallEvent
): SimulatorCallState {
  switch (state) {
    case "setup":
      if (event.type === "start") return "connecting";
      break;
    case "connecting":
      if (event.type === "connected") return "live";
      if (event.type === "failed") return "setup";
      break;
    case "live":
      if (event.type === "leave" || event.type === "end_tool") return "finishing";
      break;
    case "finishing":
      if (event.type === "feedback_ready") return "feedback";
      break;
    case "feedback":
      if (event.type === "restart") return "setup";
      break;
  }
  return state;
}

/** Stage overlay is only shown while a call exists. */
export function phaseShowsCallStage(state: SimulatorCallState): boolean {
  return state === "connecting" || state === "live" || state === "finishing";
}
