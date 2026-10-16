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
    rateVideo: vi.fn(),
    createVideoRun: vi.fn()
  }
}));

vi.mock("../../lib/videoRecording.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/videoRecording.js")>(
    "../../lib/videoRecording.js"
  );
  return {
    ...actual,
    saveVideoBlob: vi.fn().mockResolvedValue(undefined)
  };
});

const MediaDeviceCheckStub = defineComponent({
  emits: ["ready"],
  template: `<button type="button" @click="$emit('ready', {})">Enheter klare</button>`
});

const api = vi.mocked(interviewPrepApi);

function fakeStream(): MediaStream {
  return {
    getTracks: () => [{ stop: vi.fn() }],
    getAudioTracks: () => [{ kind: "audio", stop: vi.fn() }]
  } as unknown as MediaStream;
}

async function advanceToRecording(wrapper: ReturnType<typeof mount>, startLabel: string) {
  await flushPromises();
  await wrapper.findAll("button").find((b) => b.text().includes(startLabel))!.trigger("click");
  await flushPromises();
  await wrapper.get("button").trigger("click");
  await flushPromises();
  await wrapper.get(".deck-card").trigger("click");
  await flushPromises();
  await wrapper.findAll("button").find((b) => b.text() === "Start opptak nå")!.trigger("click");
  await flushPromises();
}

describe("InterviewVideoView", () => {
  const start = vi.fn();
  const stop = vi.fn(function (this: { onstop: (() => void) | null; state: string }) {
    this.state = "inactive";
    this.onstop?.();
  });

  beforeEach(() => {
    start.mockReset();
    stop.mockClear();
    api.videoSettings.mockResolvedValue({ ...defaultVideoSimulatorSettings });
    api.saveVideoSettings.mockImplementation(async (settings) => settings);
    api.transcribeVideo.mockResolvedValue({
      mock: false,
      transcript: "Mitt svar",
      feedback: {
        scores: {
          openingAndStructure: 3,
          situationAndTask: 3,
          action: 3,
          result: 3,
          learning: 3,
          ownership: 3,
          tempoAndLength: 3,
          relevance: 3
        },
        sum: 24,
        improvement: "Stram inn."
      },
      rating: "ok",
      stats: { wordCount: 2, durationMs: 1000, wordsPerMinute: 120, fillerCount: 0, fillers: {} }
    });
    api.rateVideo.mockResolvedValue({
      feedback: {
        scores: {
          openingAndStructure: 4,
          situationAndTask: 4,
          action: 4,
          result: 4,
          learning: 4,
          ownership: 4,
          tempoAndLength: 4,
          relevance: 4
        },
        sum: 32,
        improvement: "Bra."
      },
      rating: "ok",
      stats: { wordCount: 2, durationMs: 1000, wordsPerMinute: 120, fillerCount: 0, fillers: {} }
    });
    api.createVideoRun.mockResolvedValue({
      id: "run-1",
      state: "review",
      transcript: "Mitt svar",
      prompt: "q",
      settings: defaultVideoSimulatorSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(
          () => new Promise<MediaStream>((resolve) => setTimeout(() => resolve(fakeStream()), 0))
        )
      }
    });
    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      state = "recording";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start = start;
      stop = stop;
      addEventListener(type: string, handler: () => void) {
        if (type === "stop") this.onstop = handler;
      }
    }
    class FakeMediaStream {
      constructor(public tracks: unknown[]) {}
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("MediaStream", FakeMediaStream);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:review"),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts recording on the stream acquired for the recording phase", async () => {
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Start ekte runde");

    expect(wrapper.text()).not.toContain("Kunne ikke starte opptak.");
    expect(wrapper.text()).toContain("Stopp opptak");
    expect(start).toHaveBeenCalled();
  });

  it("practice round never calls transcription or run logging", async () => {
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Øverunde");

    await wrapper.findAll("button").find((b) => b.text() === "Stopp opptak")!.trigger("click");
    await flushPromises();

    expect(api.transcribeVideo).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Øverunde: ingen transkribering");

    await wrapper.findAll("button").find((b) => b.text() === "Neste kort")!.trigger("click");
    await flushPromises();
    expect(api.createVideoRun).not.toHaveBeenCalled();
  });

  it("scored round sends FormData audio and logs each card", async () => {
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Start ekte runde");

    await wrapper.findAll("button").find((b) => b.text() === "Stopp opptak")!.trigger("click");
    await flushPromises();

    expect(api.transcribeVideo).toHaveBeenCalledTimes(1);
    const payload = api.transcribeVideo.mock.calls[0]![0];
    expect(payload.file).toBeInstanceOf(Blob);
    expect(payload.withRubric).toBe(true);
    expect(payload.prompt).toBeTruthy();
    expect(payload.model).toBe(defaultVideoSimulatorSettings.ratingModel);
    expect(wrapper.text()).toContain("Transkripsjon");
    expect(wrapper.text()).toContain("STAR-vurdering");
    expect(wrapper.text()).toContain("Vurdert med");

    await wrapper.findAll("button").find((b) => b.text() === "Neste kort")!.trigger("click");
    await flushPromises();
    expect(api.createVideoRun).toHaveBeenCalledTimes(1);
    expect(api.createVideoRun.mock.calls[0]![0].transcript).toBe("Mitt svar");
    expect(api.createVideoRun.mock.calls[0]![0].feedback).toBeDefined();
  });

  it("shows rating retry without scores when rating is unavailable", async () => {
    api.transcribeVideo.mockResolvedValue({
      mock: false,
      transcript: "Mitt svar",
      feedback: null,
      rating: "unavailable",
      stats: { wordCount: 2, durationMs: 1000, wordsPerMinute: 120, fillerCount: 0, fillers: {} }
    });
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Start ekte runde");
    await wrapper.findAll("button").find((b) => b.text() === "Stopp opptak")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("KI-vurdering er ikke tilgjengelig");
    expect(wrapper.text()).not.toContain("STAR-vurdering");
    expect(wrapper.text()).toContain("Mitt svar");

    await wrapper.findAll("button").find((b) => b.text() === "Prøv vurdering på nytt")!.trigger("click");
    await flushPromises();
    expect(api.rateVideo).toHaveBeenCalledTimes(1);
    expect(api.rateVideo.mock.calls[0]![0].model).toBe(defaultVideoSimulatorSettings.ratingModel);
    expect(wrapper.text()).toContain("STAR-vurdering");
  });

  it("persists selected rating model with settings", async () => {
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await flushPromises();
    const select = wrapper.get("select");
    await select.setValue("gpt-6-luna");
    await wrapper.findAll("button").find((b) => b.text().includes("Start ekte runde"))!.trigger("click");
    await flushPromises();
    expect(api.saveVideoSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ratingModel: "gpt-6-luna" })
    );
  });

  it("shows transcription retry when transcription fails", async () => {
    api.transcribeVideo.mockRejectedValue(new Error("Transkribering feilet midlertidig."));
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Start ekte runde");
    await wrapper.findAll("button").find((b) => b.text() === "Stopp opptak")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Prøv transkribering på nytt");
    api.transcribeVideo.mockResolvedValue({
      mock: false,
      transcript: "Kom tilbake",
      feedback: {
        scores: {
          openingAndStructure: 3,
          situationAndTask: 3,
          action: 3,
          result: 3,
          learning: 3,
          ownership: 3,
          tempoAndLength: 3,
          relevance: 3
        },
        sum: 24,
        improvement: "Ok."
      },
      rating: "ok",
      stats: { wordCount: 2, durationMs: 1000, wordsPerMinute: 120, fillerCount: 0, fillers: {} }
    });
    await wrapper.findAll("button").find((b) => b.text() === "Prøv transkribering på nytt")!.trigger("click");
    await flushPromises();
    expect(api.transcribeVideo).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Kom tilbake");
  });

  it("stays on the card with an error when createVideoRun fails", async () => {
    api.createVideoRun.mockRejectedValue(new Error("Lagring feilet."));
    const wrapper = mount(InterviewVideoView, {
      global: { stubs: { MediaDeviceCheck: MediaDeviceCheckStub } }
    });
    await advanceToRecording(wrapper, "Start ekte runde");
    await wrapper.findAll("button").find((b) => b.text() === "Stopp opptak")!.trigger("click");
    await flushPromises();

    await wrapper.findAll("button").find((b) => b.text() === "Neste kort")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Lagring feilet.");
    expect(wrapper.text()).toContain("Gjennomgang");
    expect(wrapper.text()).toContain("Neste kort");
  });
});
