import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import App from "./App.vue";
import { api } from "./api";

vi.mock("./api", () => ({
  api: {
    careerMap: vi.fn(),
    companies: vi.fn(),
    courses: vi.fn(),
    paths: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
    createPath: vi.fn(),
    deletePath: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const defaultMapNode = {
  id: "energy-1",
  title: "Spor A nivaa 1: Norge, 0-3 ar",
  level: 1 as const,
  track: "ENERGY_QUANT" as const,
  items: ["Statkraft", "Equinor", "Volue"]
};

function mockInitialData(
  paths: any[] = [{ id: "path-1", name: "Saved Quant Path", description: "A saved path", targetRole: "Quant", horizon: "5+ years", steps: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  companies: any[] = [],
  mapNodes = [defaultMapNode]
) {
  mockedApi.careerMap.mockResolvedValue({ nodes: mapNodes, tracks: ["ENERGY_QUANT"] });
  mockedApi.companies.mockResolvedValue(companies);
  mockedApi.courses.mockResolvedValue([]);
  mockedApi.paths.mockResolvedValue(paths);
}

describe("App", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the dashboard directly", async () => {
    mockInitialData([]);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain("Dashboard");
    expect(wrapper.text()).toContain("Master Plan");
  });

  it("removes a saved path after a successful delete", async () => {
    mockInitialData();
    mockedApi.deletePath.mockResolvedValue(undefined);
    const wrapper = mount(App);
    await flushPromises();

    await wrapper.get("nav button:nth-child(5)").trigger("click");
    expect(wrapper.text()).toContain("Saved Quant Path");

    await wrapper.get(".actions .danger").trigger("click");
    await flushPromises();

    expect(mockedApi.deletePath).toHaveBeenCalledWith("path-1");
    expect(wrapper.text()).not.toContain("Saved Quant Path");
  });

  it("keeps a saved path visible when delete fails", async () => {
    mockInitialData();
    mockedApi.deletePath.mockRejectedValue(new Error("Delete failed"));
    const wrapper = mount(App);
    await flushPromises();

    await wrapper.get("nav button:nth-child(5)").trigger("click");
    await wrapper.get(".actions .danger").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Saved Quant Path");
    expect(wrapper.text()).toContain("Delete failed");
  });

  it("adds and removes a course from the master plan", async () => {
    mockInitialData([]);
    mockedApi.createCourse.mockResolvedValue({ id: "course-1", semester: 7, courseCode: "TDT1000", title: "Data Science", credits: 7.5, status: "planned", notes: "Forecasting", trackTags: ["ENERGY_QUANT"], sortOrder: 0 });
    mockedApi.deleteCourse.mockResolvedValue(undefined);
    const wrapper = mount(App);
    await flushPromises();

    await wrapper.get("nav button:nth-child(2)").trigger("click");
    await wrapper.get("input[placeholder='TDT4173']").setValue("TDT1000");
    await wrapper.get("input[placeholder='Machine Learning']").setValue("Data Science");
    await wrapper.get("textarea[placeholder='Hvorfor faget passer pathen']").setValue("Forecasting");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("TDT1000");
    await wrapper.get(".course-card .icon").trigger("click");
    await flushPromises();

    expect(mockedApi.deleteCourse).toHaveBeenCalledWith("course-1");
    expect(wrapper.text()).not.toContain("TDT1000");
  });

  it("builds and duplicates a custom path", async () => {
    const statkraft: any = { id: "statkraft", name: "Statkraft", description: "Power trading", tracks: ["ENERGY_QUANT"], tier: 1, geography: "Norway", roleTypes: ["Quant"], difficulty: "High", upside: "High", relevanceScore: 95 };
    mockInitialData([], [statkraft]);
    mockedApi.createPath
      .mockResolvedValueOnce({ id: "path-2", name: "Energy Quant-ruten", description: "NTNU KI til global commodity trading", targetRole: "Quantitative Analyst", horizon: "5+ years", steps: [{ id: "step-1", companyId: "statkraft", order: 0, note: "Forste sterke signal", targetRole: "Quantitative Analyst", company: statkraft }], createdAt: "2026-01-01", updatedAt: "2026-01-01" })
      .mockResolvedValueOnce({ id: "path-3", name: "Energy Quant-ruten kopi", description: "NTNU KI til global commodity trading", targetRole: "Quantitative Analyst", horizon: "5+ years", steps: [{ id: "step-2", companyId: "statkraft", order: 0, note: "Forste sterke signal", targetRole: "Quantitative Analyst", company: statkraft }], createdAt: "2026-01-01", updatedAt: "2026-01-01" });
    const wrapper = mount(App);
    await flushPromises();

    await wrapper.get("nav button:nth-child(5)").trigger("click");
    await wrapper.get(".company-card .secondary").trigger("click");
    await wrapper.get(".builder .primary").trigger("click");
    await flushPromises();

    expect(mockedApi.createPath).toHaveBeenCalledWith(expect.objectContaining({ name: "Energy Quant-ruten" }));
    expect(wrapper.text()).toContain("Energy Quant-ruten");

    await wrapper.get(".actions .secondary").trigger("click");
    await flushPromises();

    expect(mockedApi.createPath).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Energy Quant-ruten kopi" }));
    expect(wrapper.text()).toContain("Energy Quant-ruten kopi");
  });

  it("allows editing and resetting a career map node", async () => {
    mockInitialData([], [], [defaultMapNode]);
    const wrapper = mount(App);
    await flushPromises();

    await wrapper.get("nav button:nth-child(3)").trigger("click");
    await wrapper.get(".map-edit").trigger("click");
    await wrapper.get(".editor input").setValue("Spor A nivaa 1: Norge, 0-3 ar (redigert)");
    await wrapper.get(".editor textarea").setValue("Statkraft\nEquinor\nVolue\nNord Pool");
    await wrapper.get(".editor .primary").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Spor A nivaa 1: Norge, 0-3 ar (redigert)");
    expect(wrapper.text()).toContain("Nord Pool");

    await wrapper.get(".map-edit").trigger("click");
    await wrapper.get(".editor .secondary").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Spor A nivaa 1: Norge, 0-3 ar");
    expect(wrapper.text()).not.toContain("(redigert)");
  });
});
