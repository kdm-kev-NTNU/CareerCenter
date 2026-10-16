import { defineComponent, ref, shallowRef } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import {
  DEFAULT_RESEARCH_MODEL,
  defaultSimulatorSettings,
  type InterviewPrepPlanDto,
  type PrepPlanStatus
} from "@careercenter/shared";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import { connectRealtimeVoice } from "../../lib/voiceRealtime.js";
import InterviewSimulatorView from "./InterviewSimulatorView.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    simulatorSettings: vi.fn(),
    saveSimulatorSettings: vi.fn(),
    cases: vi.fn(),
    plans: vi.fn(),
    plan: vi.fn(),
    getStatus: vi.fn(),
    createSession: vi.fn(),
    sessions: vi.fn(),
    deleteSession: vi.fn(),
    sessionMessages: vi.fn(),
    createVoiceSession: vi.fn(),
    finishSession: vi.fn(),
    appendTranscript: vi.fn()
  }
}));

vi.mock("../../lib/voiceRealtime.js", () => ({
  connectRealtimeVoice: vi.fn()
}));

vi.mock("../../composables/useMediaStream.js", () => {
  const audio = { kind: "audio", enabled: true, readyState: "live", stop: vi.fn() };
  const video = { kind: "video", enabled: true, readyState: "live", stop: vi.fn() };
  const stream = shallowRef({
    getTracks: () => [audio, video],
    getAudioTracks: () => [audio],
    getVideoTracks: () => [video]
  });
  return {
    useMediaStream: () => ({
      stream,
      acquire: vi.fn(async () => undefined),
      release: vi.fn(),
      error: ref(null)
    })
  };
});

const connectVoice = vi.mocked(connectRealtimeVoice);

const api = vi.mocked(interviewPrepApi);
const Stub = defineComponent({ template: "<div />" });
const LAST_PLAN_KEY = "careercenter:simulator-plan";

function makePlan(id: string, status: PrepPlanStatus): InterviewPrepPlanDto {
  return {
    id,
    companyName: `Bedrift ${id}`,
    roleTitle: "",
    format: "interview",
    researchModel: DEFAULT_RESEARCH_MODEL,
    status,
    pipelineStep: status === "ready" ? "ready" : "searching",
    jobAdText: "",
    researchNotes: "",
    clarificationRound: 0,
    curationFilledCount: 0,
    clarifications: [],
    questions: [
      {
        id: `${id}-q1`,
        text: "Fortell om deg selv.",
        category: "behavioral",
        audience: "candidate",
        target: "interview",
        sortOrder: 0,
        source: "bank",
        included: true,
        notes: ""
      }
    ],
    tasks: [],
    recommendedCases: [],
    repeatedStoryIds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z"
  };
}

const plans = [makePlan("a", "ready"), makePlan("b", "researching")];

function finishedBehavioral(id: string, finishedAt: string, sum: number) {
  return {
    id,
    mode: "behavioral_mock" as const,
    title: "",
    prepPlanId: "a",
    planSection: "behavioral" as const,
    finishedAt,
    feedback: { scores: {} as never, sum, improvement: "" },
    createdAt: finishedAt,
    updatedAt: finishedAt
  };
}

async function mountView(path = "/interview/simulator") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/interview/simulator", name: "interview-simulator", component: InterviewSimulatorView },
      { path: "/interview/plan", name: "interview-plans", component: Stub },
      { path: "/interview/plan/:id", name: "interview-plan", component: Stub }
    ]
  });
  await router.push(path);
  const wrapper = mount(InterviewSimulatorView, {
    global: { plugins: [router], stubs: { EssentialsSheetEditor: true } }
  });
  await flushPromises();
  return { wrapper, router };
}

describe("InterviewSimulatorView plan picker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    api.simulatorSettings.mockImplementation(async (mode) => defaultSimulatorSettings(mode));
    api.saveSimulatorSettings.mockImplementation(async (input) => ({
      ...defaultSimulatorSettings(input.mode),
      ...input,
      essentialsSheet: input.essentialsSheet ?? "",
      essentialsIsDefault: input.essentialsSheet === null
    }));
    api.cases.mockResolvedValue([]);
    api.plans.mockResolvedValue(plans);
    api.plan.mockImplementation(async (id) => ({ plan: plans.find((p) => p.id === id)!, rankedCases: [] }));
    api.getStatus.mockResolvedValue({ aiConfigured: true });
    api.sessionMessages.mockResolvedValue([]);
    api.sessions.mockResolvedValue([]);
    api.createVoiceSession.mockResolvedValue({
      mock: true,
      model: "gpt-realtime",
      clientSecret: "secret",
      expiresAt: "2026-10-15T12:00:00.000Z",
      tools: []
    });
    connectVoice.mockResolvedValue({
      pc: {} as RTCPeerConnection,
      stop: vi.fn()
    });
  });

  it("lists saved plans and disables plans that are not ready", async () => {
    const { wrapper } = await mountView();

    const options = wrapper.findAll("[data-test='plan-select'] option");
    expect(options.map((o) => o.text())).toEqual([
      "Ingen plan (generell øving)",
      "Bedrift a",
      "Bedrift b (Researcher)"
    ]);
    expect(options[2].attributes("disabled")).toBeDefined();
  });

  it("selecting a plan puts it in the URL, loads it and remembers it", async () => {
    const { wrapper, router } = await mountView();

    await wrapper.get("[data-test='plan-select']").setValue("a");
    await flushPromises();

    expect(router.currentRoute.value.query.planId).toBe("a");
    expect(api.plan).toHaveBeenCalledWith("a");
    expect(wrapper.get("[data-test='plan-practice-label']").text()).toBe("Plan: Bedrift a (1 spørsmål)");
    expect(localStorage.getItem(LAST_PLAN_KEY)).toBe("a");
  });

  it("reopens the last plan when the simulator is opened without one", async () => {
    localStorage.setItem(LAST_PLAN_KEY, "a");
    const { wrapper, router } = await mountView();

    expect(router.currentRoute.value.query.planId).toBe("a");
    expect((wrapper.get("[data-test='plan-select']").element as HTMLSelectElement).value).toBe("a");
  });

  it("does not reopen a remembered plan that is no longer ready", async () => {
    localStorage.setItem(LAST_PLAN_KEY, "b");
    const { router } = await mountView();

    expect(router.currentRoute.value.query.planId).toBeUndefined();
    expect(api.plan).not.toHaveBeenCalled();
  });

  it("choosing no plan forgets the remembered plan", async () => {
    const { wrapper, router } = await mountView("/interview/simulator?planId=a");
    expect(localStorage.getItem(LAST_PLAN_KEY)).toBe("a");

    await wrapper.get("[data-test='plan-select']").setValue("");
    await flushPromises();

    expect(router.currentRoute.value.query.planId).toBeUndefined();
    expect(localStorage.getItem(LAST_PLAN_KEY)).toBeNull();
    expect(wrapper.find("[data-test='plan-practice-label']").exists()).toBe(false);
  });

  it("starts the session with the selected plan", async () => {
    api.createSession.mockResolvedValue({ id: "s1" } as Awaited<ReturnType<typeof api.createSession>>);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='start-recording']").trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Test-sesjon");
    expect(wrapper.text()).not.toContain("Tekst");
    expect(wrapper.text()).not.toContain("Stemme-sesjon");
    expect(api.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ prepPlanId: "a", title: "Øving: Bedrift a" })
    );
    expect(api.createSession.mock.calls[0]?.[0]).not.toHaveProperty("practice");
    expect(api.createVoiceSession).toHaveBeenCalledWith("s1");
  });

  it("shows a card per plan section and starts the session for the chosen one", async () => {
    api.createSession.mockResolvedValue({ id: "s1" } as Awaited<ReturnType<typeof api.createSession>>);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    expect(api.sessions).toHaveBeenCalledWith({ prepPlanId: "a" });
    const cards = wrapper.findAll("[data-test='plan-sections'] .section-card");
    expect(cards.map((card) => card.find(".section-card__label").text())).toEqual(["Hele intervjuet", "Atferd (STAR)"]);
    expect(wrapper.get("[data-test='section-card-full']").attributes("aria-pressed")).toBe("true");

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    expect(wrapper.get("[data-test='start-recording']").text()).toBe("Start: Atferd (STAR)");

    await wrapper.get("[data-test='start-recording']").trigger("click");
    await flushPromises();

    expect(api.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prepPlanId: "a",
        planSection: "behavioral",
        title: "Øving: Bedrift a – Atferd (STAR)"
      })
    );
  });

  it("marks sections that have a finished session with the latest score and delta", async () => {
    api.sessions.mockResolvedValue([
      {
        id: "old",
        mode: "behavioral_mock",
        title: "",
        prepPlanId: "a",
        planSection: "behavioral",
        finishedAt: "2026-10-03T10:00:00.000Z",
        feedback: { scores: {} as never, sum: 9, improvement: "" },
        createdAt: "2026-10-03T09:00:00.000Z",
        updatedAt: "2026-10-03T10:00:00.000Z"
      },
      {
        id: "new",
        mode: "behavioral_mock",
        title: "",
        prepPlanId: "a",
        planSection: "behavioral",
        finishedAt: "2026-10-04T10:00:00.000Z",
        feedback: { scores: {} as never, sum: 14, improvement: "" },
        createdAt: "2026-10-04T09:00:00.000Z",
        updatedAt: "2026-10-04T10:00:00.000Z"
      }
    ]);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    const card = wrapper.get("[data-test='section-card-behavioral']");
    expect(card.classes()).toContain("section-card--done");
    expect(card.text()).toContain("v2 · sum 14 (+5)");
    expect(wrapper.get("[data-test='plan-sections']").text()).toContain("1 av 1 seksjoner øvd");
    expect(wrapper.get("[data-test='section-card-full']").classes()).not.toContain("section-card--done");
    expect(wrapper.find("[data-test='section-retry-behavioral']").exists()).toBe(true);

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    const history = wrapper.get("[data-test='section-attempt-history']");
    expect(history.text()).toContain("Historikk – Atferd (STAR) (2 forsøk)");
    expect(wrapper.find("[data-test='attempt-history-list']").exists()).toBe(false);

    await wrapper.get("[data-test='attempt-history-toggle']").trigger("click");
    expect(wrapper.get("[data-test='attempt-history-list']").text()).toContain("Versjon 1");
    expect(wrapper.get("[data-test='attempt-history-list']").text()).toContain("Versjon 2");
  });

  it("øv på nytt shows the section as never practised and waits for the user to start", async () => {
    api.sessions.mockResolvedValue([finishedBehavioral("old", "2026-10-03T10:00:00.000Z", 9)]);
    api.createSession.mockResolvedValue({ id: "s2" } as Awaited<ReturnType<typeof api.createSession>>);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-retry-behavioral']").trigger("click");
    await flushPromises();

    expect(api.createSession).not.toHaveBeenCalled();
    const card = wrapper.get("[data-test='section-card-behavioral']");
    expect(card.attributes("aria-pressed")).toBe("true");
    expect(card.classes()).not.toContain("section-card--done");
    expect(card.text()).toContain("1 spørsmål");
    expect(card.text()).not.toContain("v1");
    expect(wrapper.find("[data-test='section-retry-behavioral']").exists()).toBe(false);
    expect(wrapper.get("[data-test='plan-sections']").text()).toContain("0 av 1 seksjoner øvd");
    expect(wrapper.find("[data-test='attempt-history-list']").exists()).toBe(false);
    expect(wrapper.get("[data-test='section-attempt-history']").text()).toContain("(1 forsøk)");

    await wrapper.get("[data-test='start-recording']").trigger("click");
    await flushPromises();
    expect(api.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ prepPlanId: "a", planSection: "behavioral" })
    );
  });

  it("selecting another section ends the fresh start", async () => {
    api.sessions.mockResolvedValue([finishedBehavioral("old", "2026-10-03T10:00:00.000Z", 9)]);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-retry-behavioral']").trigger("click");
    await wrapper.get("[data-test='section-card-full']").trigger("click");

    expect(wrapper.get("[data-test='section-card-behavioral']").text()).toContain("v1 · sum 9");
  });

  it("deletes an attempt after confirmation and renumbers the rest", async () => {
    api.sessions.mockResolvedValue([
      finishedBehavioral("old", "2026-10-03T10:00:00.000Z", 9),
      finishedBehavioral("new", "2026-10-04T10:00:00.000Z", 14)
    ]);
    api.deleteSession.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    await wrapper.get("[data-test='attempt-history-toggle']").trigger("click");
    await wrapper.get("[data-test='attempt-delete-1']").trigger("click");
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Slette versjon 1?"));
    expect(api.deleteSession).toHaveBeenCalledWith("old");
    const list = wrapper.get("[data-test='attempt-history-list']");
    expect(list.findAll("[data-test^='attempt-row-']")).toHaveLength(1);
    expect(list.text()).toContain("Versjon 1");
    expect(wrapper.get("[data-test='section-card-behavioral']").text()).toContain("v1 · sum 14");
    confirmSpy.mockRestore();
  });

  it("keeps the attempt when the deletion is not confirmed", async () => {
    api.sessions.mockResolvedValue([finishedBehavioral("old", "2026-10-03T10:00:00.000Z", 9)]);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    await wrapper.get("[data-test='attempt-history-toggle']").trigger("click");
    await wrapper.get("[data-test='attempt-delete-1']").trigger("click");
    await flushPromises();

    expect(api.deleteSession).not.toHaveBeenCalled();
    expect(wrapper.get("[data-test='section-card-behavioral']").classes()).toContain("section-card--done");
    confirmSpy.mockRestore();
  });

  it("hides the section and its history once every attempt is deleted", async () => {
    api.sessions.mockResolvedValue([finishedBehavioral("old", "2026-10-03T10:00:00.000Z", 9)]);
    api.deleteSession.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    await wrapper.get("[data-test='attempt-history-toggle']").trigger("click");
    await wrapper.get("[data-test='attempt-delete-1']").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='section-attempt-history']").exists()).toBe(false);
    expect(wrapper.get("[data-test='section-card-behavioral']").classes()).not.toContain("section-card--done");
    confirmSpy.mockRestore();
  });

  it("loads the transcript when an attempt row is opened", async () => {
    api.sessions.mockResolvedValue([
      {
        id: "sess-v1",
        mode: "behavioral_mock",
        title: "",
        prepPlanId: "a",
        planSection: "behavioral",
        finishedAt: "2026-10-03T10:00:00.000Z",
        feedback: {
          scores: {
            openingAndStructure: 2,
            situationAndTask: 2,
            action: 2,
            result: 2,
            learning: 2,
            ownership: 2,
            tempoAndLength: 2,
            relevance: 2
          },
          sum: 16,
          improvement: "Mer konkrete tall."
        },
        createdAt: "2026-10-03T09:00:00.000Z",
        updatedAt: "2026-10-03T10:00:00.000Z"
      }
    ]);
    api.sessionMessages.mockResolvedValue([
      { id: "sys", role: "system", content: "system prompt", createdAt: "2026-10-03T09:00:00.000Z" },
      { id: "m1", role: "assistant", content: "Fortell om en konflikt.", createdAt: "2026-10-03T09:01:00.000Z" },
      { id: "m2", role: "user", content: "Jeg løste en konflikt i teamet.", createdAt: "2026-10-03T09:02:00.000Z" }
    ]);
    const { wrapper } = await mountView("/interview/simulator?planId=a");

    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    await wrapper.get("[data-test='attempt-history-toggle']").trigger("click");
    await wrapper.get("[data-test='attempt-row-1']").trigger("click");
    await flushPromises();

    expect(api.sessionMessages).toHaveBeenCalledWith("sess-v1");
    const transcript = wrapper.get("[data-test='attempt-transcript']");
    expect(transcript.text()).toContain("Fortell om en konflikt.");
    expect(transcript.text()).toContain("Jeg løste en konflikt i teamet.");
    expect(transcript.text()).not.toContain("system prompt");
    expect(wrapper.get("[data-test='attempt-detail-1']").text()).toContain("Mer konkrete tall.");
  });

  it("Start ny samtale keeps the selected section and starts the next version", async () => {
    const stop = vi.fn();
    api.createSession
      .mockResolvedValueOnce({
        id: "s1",
        mode: "behavioral_mock",
        title: "Øving: Bedrift a – Atferd (STAR)",
        prepPlanId: "a",
        planSection: "behavioral",
        createdAt: "2026-10-15T12:00:00.000Z",
        updatedAt: "2026-10-15T12:00:00.000Z"
      } as Awaited<ReturnType<typeof api.createSession>>)
      .mockResolvedValueOnce({
        id: "s2",
        mode: "behavioral_mock",
        title: "Øving: Bedrift a – Atferd (STAR)",
        prepPlanId: "a",
        planSection: "behavioral",
        createdAt: "2026-10-15T12:10:00.000Z",
        updatedAt: "2026-10-15T12:10:00.000Z"
      } as Awaited<ReturnType<typeof api.createSession>>);
    api.createVoiceSession.mockResolvedValue({
      mock: false,
      model: "gpt-realtime",
      clientSecret: "secret",
      expiresAt: "2026-10-15T12:00:00.000Z",
      tools: []
    });
    connectVoice.mockResolvedValue({ pc: {} as RTCPeerConnection, stop });
    api.finishSession.mockResolvedValue({
      id: "s1",
      mode: "behavioral_mock",
      title: "Øving: Bedrift a – Atferd (STAR)",
      prepPlanId: "a",
      planSection: "behavioral",
      finishedAt: "2026-10-15T12:05:00.000Z",
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
        improvement: "Bra."
      },
      createdAt: "2026-10-15T12:00:00.000Z",
      updatedAt: "2026-10-15T12:05:00.000Z"
    });

    const { wrapper } = await mountView("/interview/simulator?planId=a");
    await wrapper.get("[data-test='section-card-behavioral']").trigger("click");
    await wrapper.get("[data-test='start-recording']").trigger("click");
    await flushPromises();

    const leave = document.body.querySelector("[data-test='leave-call']") as HTMLButtonElement;
    leave.click();
    await flushPromises();

    await wrapper.get("[data-test='restart-session']").trigger("click");
    await flushPromises();

    expect(api.createSession).toHaveBeenCalledTimes(2);
    expect(api.createSession.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ prepPlanId: "a", planSection: "behavioral" })
    );
    // Tear down the live call stage so it does not leak into the next test via Teleport.
    wrapper.unmount();
  });

  it("opens the call stage for a live voice session and closes it after leave", async () => {
    const stop = vi.fn();
    api.createSession.mockResolvedValue({ id: "s1" } as Awaited<ReturnType<typeof api.createSession>>);
    api.createVoiceSession.mockResolvedValue({
      mock: false,
      model: "gpt-realtime",
      clientSecret: "secret",
      expiresAt: "2026-10-15T12:00:00.000Z",
      tools: []
    });
    connectVoice.mockResolvedValue({ pc: {} as RTCPeerConnection, stop });
    api.finishSession.mockResolvedValue({
      id: "s1",
      mode: "behavioral_mock",
      title: "Øving: Bedrift a",
      prepPlanId: "a",
      finishedAt: "2026-10-15T12:05:00.000Z",
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
        improvement: "Avslutt med resultat."
      },
      createdAt: "2026-10-15T12:00:00.000Z",
      updatedAt: "2026-10-15T12:05:00.000Z"
    });

    const { wrapper } = await mountView("/interview/simulator?planId=a");
    await wrapper.get("[data-test='start-recording']").trigger("click");
    await flushPromises();

    expect(document.body.querySelector("[data-test='call-stage']")).not.toBeNull();
    expect(document.body.querySelector("[data-test='call-stage']")?.getAttribute("data-call-state")).toBe(
      "live"
    );
    expect(connectVoice).toHaveBeenCalled();

    const leave = document.body.querySelector("[data-test='leave-call']");
    expect(leave).not.toBeNull();
    (leave as HTMLButtonElement).click();
    await flushPromises();

    expect(stop).toHaveBeenCalled();
    expect(api.finishSession).toHaveBeenCalledWith("s1");
    expect(document.body.querySelector("[data-test='call-stage']")).toBeNull();
    expect(wrapper.get("[data-test='feedback-panel']").text()).toContain("Feedback (sum 24)");
  });
});
