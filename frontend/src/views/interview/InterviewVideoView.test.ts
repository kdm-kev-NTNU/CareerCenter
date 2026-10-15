import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultVideoSimulatorSettings } from "@careercenter/shared";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import InterviewVideoView from "./InterviewVideoView.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    videoSettings: vi.fn(),
    saveVideoSettings: vi.fn(),
    transcribeVideo: vi.fn(),
    createVideoRun: vi.fn()
  }
}));

const MediaDeviceCheckStub = defineComponent({
  emits: ["ready"],
  template: `<button type="button" @click="$emit('ready', {})">Enheter klare</button>`
});

const api = vi.mocked(interviewPrepApi);

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

describe("InterviewVideoView", () => {
  const start = vi.fn();

  beforeEach(() => {
    start.mockReset();
    api.videoSettings.mockResolvedValue({ ...defaultVideoSimulatorSettings });
    api.saveVideoSettings.mockImplementation(async (settings) => settings);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(
          () => new Promise<MediaStream>((resolve) => setTimeout(() => resolve(fakeStream()), 0))
        )
      }
    });
    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      start = start;
      stop = vi.fn();
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts recording on the stream acquired for the recording phase", async () => {
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await flushPromises();

    await wrapper.findAll("button").find((b) => b.text().startsWith("Bekreft"))!.trigger("click");
    await flushPromises();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    await wrapper.get(".deck-card").trigger("click");
    await flushPromises();
    await wrapper.findAll("button").find((b) => b.text() === "Start opptak nå")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Kunne ikke starte opptak.");
    expect(wrapper.text()).toContain("Stopp opptak");
    expect(start).toHaveBeenCalledTimes(1);
  });
});
