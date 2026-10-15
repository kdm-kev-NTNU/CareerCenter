export const videoSimStates = [
  "setup",
  "device_check",
  "deck",
  "thinking",
  "recording",
  "review",
  "done"
] as const;
export type VideoSimState = (typeof videoSimStates)[number];

/** practice = local-only (no AI); scored = transcription + rubric. */
export const practiceModes = ["practice", "scored"] as const;
export type PracticeMode = (typeof practiceModes)[number];

/** Single source of truth: AI rating/transcription only for scored rounds. */
export function modeUsesAi(mode: PracticeMode): boolean {
  return mode === "scored";
}

export type VideoSimEvent =
  | { type: "settings_confirmed" }
  | { type: "devices_ready" }
  | { type: "devices_failed" }
  | { type: "card_selected" }
  | { type: "think_elapsed" }
  | { type: "stop_recording" }
  | { type: "answer_elapsed" }
  | { type: "retake" }
  | { type: "next_card" }
  | { type: "all_done" }
  | { type: "leave" };

/**
 * Pure video application simulator state machine.
 * Invariant: recording cannot start before think time has elapsed.
 */
export function transitionVideoSim(state: VideoSimState, event: VideoSimEvent): VideoSimState {
  if (event.type === "leave") return "done";

  switch (state) {
    case "setup":
      if (event.type === "settings_confirmed") return "device_check";
      break;
    case "device_check":
      if (event.type === "devices_ready") return "deck";
      if (event.type === "devices_failed") return "setup";
      break;
    case "deck":
      if (event.type === "card_selected") return "thinking";
      if (event.type === "all_done") return "done";
      break;
    case "thinking":
      // Only think_elapsed may enter recording — never skip
      if (event.type === "think_elapsed") return "recording";
      break;
    case "recording":
      if (event.type === "stop_recording" || event.type === "answer_elapsed") return "review";
      break;
    case "review":
      if (event.type === "retake") return "thinking";
      if (event.type === "next_card") return "deck";
      if (event.type === "all_done") return "done";
      break;
    case "done":
      break;
  }
  return state;
}

/** Recording is only legal after thinking completed. */
export function canStartRecording(state: VideoSimState): boolean {
  return state === "recording";
}

/** Camera/mic stream may only be open during device check and recording. */
export function phaseNeedsCamera(state: VideoSimState): boolean {
  return state === "device_check" || state === "recording";
}

/** Question text may only be revealed after a card is selected. */
export function phaseRevealsPrompt(state: VideoSimState): boolean {
  return state === "thinking" || state === "recording" || state === "review";
}
