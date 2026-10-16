import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewCallStage from "./InterviewCallStage.vue";

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

function mountStage(
  props: Partial<{
    callState: "setup" | "connecting" | "live" | "finishing" | "feedback";
    companyName: string;
    modeLabel: string;
    initials: string;
    stream: MediaStream | null;
    muted: boolean;
    interviewerSpeaking: boolean;
    userSpeaking: boolean;
  }> = {}
) {
  return mount(InterviewCallStage, {
    props: {
      callState: "live",
      companyName: "Equinor",
      modeLabel: "PEI · behavioral",
      initials: "KD",
      ...props
    },
    attachTo: document.body
  });
}

function qs(selector: string) {
  return document.body.querySelector(selector);
}

describe("InterviewCallStage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("emits leave when Avslutt is clicked", async () => {
    const wrapper = mountStage();
    (qs("[data-test='leave-call']") as HTMLButtonElement).click();
    expect(wrapper.emitted("leave")).toHaveLength(1);
    wrapper.unmount();
  });

  it("emits toggle-mute when Demp is clicked", async () => {
    const wrapper = mountStage();
    (qs("[data-test='toggle-mute']") as HTMLButtonElement).click();
    expect(wrapper.emitted("toggle-mute")).toHaveLength(1);
    wrapper.unmount();
  });

  it("shows a speaking ring on the interviewer tile", () => {
    const wrapper = mountStage({ interviewerSpeaking: true });
    expect(qs("[data-test='interviewer-tile']")?.classList.contains("call-stage__main--speaking")).toBe(
      true
    );
    wrapper.unmount();
  });

  it("shows a speaking ring on the self tile when the user speaks", () => {
    const wrapper = mountStage({ userSpeaking: true });
    expect(qs("[data-test='self-tile']")?.classList.contains("call-stage__self--speaking")).toBe(true);
    wrapper.unmount();
  });

  it("renders a video element when the stream has a live video track", () => {
    const stream = {
      getVideoTracks: () => [{ readyState: "live", kind: "video" }],
      getAudioTracks: () => [{ readyState: "live", kind: "audio" }]
    } as unknown as MediaStream;
    const wrapper = mountStage({ stream });
    expect(qs("[data-test='self-video']")).not.toBeNull();
    expect(qs("[data-test='self-initials']")).toBeNull();
    wrapper.unmount();
  });

  it("falls back to initials when there is no video track", () => {
    const stream = {
      getVideoTracks: () => [],
      getAudioTracks: () => [{ readyState: "live", kind: "audio" }]
    } as unknown as MediaStream;
    const wrapper = mountStage({ stream, initials: "KD" });
    expect(qs("[data-test='self-initials']")?.textContent).toContain("KD");
    wrapper.unmount();
  });

  it("shows connecting overlay while connecting", () => {
    const wrapper = mountStage({ callState: "connecting" });
    expect(qs("[data-test='connecting-overlay']")).not.toBeNull();
    expect(qs("[data-test='call-timer']")?.textContent).toBe("Kobler til …");
    wrapper.unmount();
  });

  it("shows mute toast and badge when muted", () => {
    const wrapper = mountStage({ muted: true });
    expect(qs("[data-test='mute-toast']")).not.toBeNull();
    expect(qs("[data-test='mute-badge']")).not.toBeNull();
    wrapper.unmount();
  });
});
