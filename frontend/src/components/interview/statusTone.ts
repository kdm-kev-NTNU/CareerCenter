import type { PrepPlanStatus, VideoSimState } from "@careercenter/shared";
import { prepPlanStatuses, videoSimStates } from "@careercenter/shared";

export type BadgeVariant = "accent" | "muted" | "blue" | "danger";

export type StatusTone = {
  label: string;
  variant: BadgeVariant;
};

export const prepPlanStatusTone = {
  draft: { label: "Utkast", variant: "muted" },
  researching: { label: "Researcher", variant: "blue" },
  awaiting_answers: { label: "Venter på svar", variant: "muted" },
  curating: { label: "Kurerer", variant: "blue" },
  ready: { label: "Klar", variant: "accent" },
  failed: { label: "Feilet", variant: "danger" }
} as const satisfies Record<PrepPlanStatus, StatusTone>;

void (prepPlanStatuses satisfies readonly (keyof typeof prepPlanStatusTone)[]);

export function toneForPrepPlanStatus(status: PrepPlanStatus): StatusTone {
  return prepPlanStatusTone[status];
}

export const videoPhaseTone = {
  setup: { label: "Oppsett", variant: "muted" },
  device_check: { label: "Enhetssjekk", variant: "blue" },
  deck: { label: "Kortstokk", variant: "muted" },
  thinking: { label: "Betenkningstid", variant: "muted" },
  recording: { label: "Opptak", variant: "danger" },
  review: { label: "Gjennomgang", variant: "accent" },
  done: { label: "Ferdig", variant: "accent" }
} as const satisfies Record<VideoSimState, StatusTone>;

void (videoSimStates satisfies readonly (keyof typeof videoPhaseTone)[]);

export function toneForVideoPhase(phase: VideoSimState): StatusTone {
  return videoPhaseTone[phase];
}
