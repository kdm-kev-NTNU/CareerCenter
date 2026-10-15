import { defineComponent } from "vue";
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
    sessionMessages: vi.fn(),
    createVoiceSession: vi.fn()
  }
}));

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
    global: { plugins: [router], stubs: { EssentialsSheetEditor: true, MediaDeviceCheck: true } }
  });
  await flushPromises();
  return { wrapper, router };
}

describe("InterviewSimulatorView plan picker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
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
    api.createVoiceSession.mockResolvedValue({
      mock: true,
      model: "gpt-realtime",
      clientSecret: "secret",
      expiresAt: "2026-10-15T12:00:00.000Z",
      tools: []
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

    await wrapper.findAll("button").find((b) => b.text() === "Start ny sesjon")!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("Test-sesjon");
    expect(wrapper.text()).not.toContain("Tekst");
    expect(api.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ prepPlanId: "a", title: "Øving: Bedrift a" })
    );
    expect(api.createSession.mock.calls[0]?.[0]).not.toHaveProperty("practice");
    expect(api.createVoiceSession).toHaveBeenCalledWith("s1");
  });
});
