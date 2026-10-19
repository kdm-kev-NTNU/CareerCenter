import { defineComponent } from "vue";
import { flushPromises, mount, type DOMWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { DEFAULT_RESEARCH_MODEL, type InterviewPrepPlanDto, type PrepPlanStatus } from "@careercenter/shared";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import InterviewPlansView from "./InterviewPlansView.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    plans: vi.fn(),
    deletePlan: vi.fn()
  }
}));

const api = vi.mocked(interviewPrepApi);
const Stub = defineComponent({ template: "<div />" });

function makePlan(id: string, status: PrepPlanStatus, included = 2): InterviewPrepPlanDto {
  return {
    id,
    companyName: `Bedrift ${id}`,
    roleTitle: "Analytiker",
    format: "interview",
    researchModel: DEFAULT_RESEARCH_MODEL,
    status,
    pipelineStep: status === "ready" ? "ready" : "searching",
    jobAdText: "",
    researchNotes: "",
    clarificationRound: 0,
    curationFilledCount: 0,
    clarifications: [],
    questions: Array.from({ length: included }, (_, i) => ({
      id: `${id}-q${i}`,
      text: "Fortell om deg selv.",
      category: "behavioral",
      audience: "candidate",
      target: "interview",
      sortOrder: i,
      source: "bank",
      included: true,
      notes: "",
      exampleAnswer: "",
      tips: []
    })),
    repeatedStoryIds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z"
  };
}

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/interview/plan", name: "interview-plans", component: InterviewPlansView },
      { path: "/interview/plan/ny", name: "interview-plan-new", component: Stub },
      { path: "/interview/plan/:id", name: "interview-plan", component: Stub },
      { path: "/interview/simulator", name: "interview-simulator", component: Stub }
    ]
  });
  await router.push("/interview/plan");
  const wrapper = mount(InterviewPlansView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe("InterviewPlansView", () => {
  beforeEach(() => {
    api.plans.mockReset();
    api.deletePlan.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function deleteButton(row: Pick<DOMWrapper<Element>, "findAll">) {
    return row.findAll("button").find((b) => b.text() === "Slett")!;
  }

  it("lists saved plans and only offers practice for ready plans with questions", async () => {
    api.plans.mockResolvedValue([makePlan("a", "ready"), makePlan("b", "researching", 0), makePlan("c", "ready", 0)]);
    const { wrapper } = await mountView();

    const rows = wrapper.findAll("[data-test='plan-list'] li");
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain("Bedrift a");
    expect(rows[0].text()).toContain("2 spørsmål i øving");
    expect(rows[0].text()).toContain("Klar");
    expect(rows[1].text()).toContain("Researcher");
    expect(rows.map((row) => row.findAll("button").some((b) => b.text() === "Øv"))).toEqual([true, false, false]);
  });

  it("opens the simulator with the chosen plan", async () => {
    api.plans.mockResolvedValue([makePlan("a", "ready")]);
    const { wrapper, router } = await mountView();

    await wrapper.findAll("button").find((b) => b.text() === "Øv")!.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("interview-simulator");
    expect(router.currentRoute.value.query.planId).toBe("a");
  });

  it("opens a plan to continue working on it", async () => {
    api.plans.mockResolvedValue([makePlan("b", "awaiting_answers", 0)]);
    const { wrapper, router } = await mountView();

    await wrapper.findAll("button").find((b) => b.text() === "Åpne")!.trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/interview/plan/b");
  });

  it("deletes a plan after confirmation and removes it from the list", async () => {
    api.plans.mockResolvedValue([makePlan("a", "ready"), makePlan("b", "failed", 0)]);
    api.deletePlan.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { wrapper } = await mountView();

    await deleteButton(wrapper.findAll("[data-test='plan-list'] li")[1]).trigger("click");
    await flushPromises();

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Bedrift b"));
    expect(api.deletePlan).toHaveBeenCalledWith("b");
    expect(wrapper.findAll("[data-test='plan-list'] li").map((row) => row.find("strong").text())).toEqual([
      "Bedrift a"
    ]);
  });

  it("keeps the plan when deletion is not confirmed", async () => {
    api.plans.mockResolvedValue([makePlan("a", "ready")]);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { wrapper } = await mountView();

    await deleteButton(wrapper.get("[data-test='plan-list'] li")).trigger("click");
    await flushPromises();

    expect(api.deletePlan).not.toHaveBeenCalled();
    expect(wrapper.findAll("[data-test='plan-list'] li")).toHaveLength(1);
  });

  it("does not offer deletion while research runs and shows a refusal from the server", async () => {
    api.plans.mockResolvedValue([makePlan("a", "researching", 0), makePlan("b", "awaiting_answers", 0)]);
    api.deletePlan.mockRejectedValue(new Error("Planen kan ikke slettes mens research eller kuratering pågår."));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { wrapper } = await mountView();
    const rows = wrapper.findAll("[data-test='plan-list'] li");

    expect(deleteButton(rows[0]).attributes("disabled")).toBeDefined();
    await deleteButton(rows[1]).trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Planen kan ikke slettes mens research eller kuratering pågår.");
    expect(wrapper.findAll("[data-test='plan-list'] li")).toHaveLength(2);
  });

  it("shows an empty state when there are no plans", async () => {
    api.plans.mockResolvedValue([]);
    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Du har ingen planer ennå");
  });
});
