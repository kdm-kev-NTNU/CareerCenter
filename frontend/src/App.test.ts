import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { careerTrackDefaults } from "@careercenter/shared";
import App from "./App.vue";
import { authApi } from "./api/auth.js";
import { api } from "./api/index.js";
import router from "./router/index.js";
import { useAuthStore } from "./stores/auth.js";
import { useCareerMapStore } from "./stores/careerMap.js";

vi.mock("./components/board/CareerBoardCanvas.vue", () => ({
  default: { template: '<div class="board-canvas-stub" />' }
}));

vi.mock("./api/auth.js", () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({ id: "user-1", name: "Test" }),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  }
}));

vi.mock("./api/index.js", () => ({
  api: {
    tracks: vi.fn(),
    boards: vi.fn(),
    board: vi.fn(),
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    deleteBoard: vi.fn(),
    duplicateBoard: vi.fn(),
    updateTrack: vi.fn(),
    resetTrack: vi.fn(),
    companies: vi.fn(),
    courses: vi.fn(),
    paths: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
    createPath: vi.fn(),
    updatePath: vi.fn(),
    deletePath: vi.fn(),
    competitions: vi.fn(),
    settings: vi.fn(),
    internships: vi.fn(),
    selfStudyCourses: vi.fn(),
    educationBooks: vi.fn(),
    learningPlatforms: vi.fn(),
    bachelorKnowledge: vi.fn(),
    bachelorFolderTree: vi.fn(),
    bachelorFiles: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);
const mockedAuthApi = vi.mocked(authApi);

const defaultBoard = {
  id: "board-1",
  name: "Karrierekart",
  description: "Standard",
  viewport: { x: 0, y: 0, zoom: 0.75 },
  graph: {
    nodes: [
      { id: "node-now", type: "milestone" as const, position: { x: 0, y: 0 }, data: { label: "NTNU KI" } },
      { id: "node-statkraft", type: "company" as const, position: { x: 100, y: 120 }, data: { companyId: "statkraft" } }
    ],
    edges: [{ id: "e1", source: "node-now", target: "node-statkraft", label: "Start" }]
  },
  isDefault: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

function mockInitialData(
  paths: any[] = [{ id: "path-1", name: "Saved Quant Path", description: "A saved path", targetRole: "Quant", horizon: "5+ years", steps: [], createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  companies: any[] = []
) {
  mockedApi.tracks.mockResolvedValue(careerTrackDefaults);
  mockedApi.boards.mockResolvedValue([
    { id: defaultBoard.id, name: defaultBoard.name, description: defaultBoard.description, isDefault: true, createdAt: defaultBoard.createdAt, updatedAt: defaultBoard.updatedAt }
  ]);
  mockedApi.board.mockResolvedValue(defaultBoard);
  mockedApi.updateBoard.mockResolvedValue(defaultBoard);
  mockedApi.companies.mockResolvedValue(companies);
  mockedApi.courses.mockResolvedValue([]);
  mockedApi.paths.mockResolvedValue(paths);
  mockedApi.competitions.mockResolvedValue([]);
  mockedApi.settings.mockResolvedValue({ statuses: [], locations: [], requirementTypes: [] });
  mockedApi.internships.mockResolvedValue([]);
  mockedApi.selfStudyCourses.mockResolvedValue([]);
  mockedApi.educationBooks.mockResolvedValue([]);
  mockedApi.learningPlatforms.mockResolvedValue([]);
  mockedApi.bachelorKnowledge.mockResolvedValue([]);
  mockedApi.bachelorFolderTree.mockResolvedValue([]);
  mockedApi.bachelorFiles.mockResolvedValue([]);
}

function primeAuth(pinia: ReturnType<typeof createPinia>) {
  const auth = useAuthStore(pinia);
  auth.user = { id: "user-1", name: "Test" };
  auth.loading = false;
}

async function mountApp(route = "/") {
  const pinia = createPinia();
  setActivePinia(pinia);
  primeAuth(pinia);
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router]
    }
  });
  await router.push(route);
  await router.isReady();
  await flushPromises();
  return wrapper;
}

async function goTo(route: string) {
  await router.push(route);
  await router.isReady();
  await flushPromises();
}

describe("App", () => {
  beforeEach(() => {
    mockedAuthApi.me.mockResolvedValue({ id: "user-1", name: "Test" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockedAuthApi.me.mockResolvedValue({ id: "user-1", name: "Test" });
    localStorage.clear();
  });

  it("renders the dashboard directly", async () => {
    mockInitialData([]);
    const wrapper = await mountApp();
    expect(wrapper.text()).toContain("Dashboard");
    expect(wrapper.text()).toContain("Master Plan");
  });

  it("removes a saved path after a successful delete", async () => {
    mockInitialData();
    mockedApi.deletePath.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", () => true);
    const wrapper = await mountApp();
    await goTo("/paths");
    expect(wrapper.text()).toContain("Saved Quant Path");

    await wrapper.get(".actions .danger").trigger("click");
    vi.unstubAllGlobals();
    await flushPromises();

    expect(mockedApi.deletePath).toHaveBeenCalledWith("path-1");
    expect(wrapper.text()).not.toContain("Saved Quant Path");
  });

  it("keeps a saved path visible when delete fails", async () => {
    mockInitialData();
    mockedApi.deletePath.mockRejectedValue(new Error("Delete failed"));
    vi.stubGlobal("confirm", () => true);
    const wrapper = await mountApp();
    await goTo("/paths");
    await wrapper.get(".actions .danger").trigger("click");
    vi.unstubAllGlobals();
    await flushPromises();

    expect(wrapper.text()).toContain("Saved Quant Path");
    expect(wrapper.text()).toContain("Delete failed");
  });

  it("adds and removes a course from the master plan", async () => {
    mockInitialData([]);
    mockedApi.createCourse.mockResolvedValue({ id: "course-1", semester: 7, courseCode: "TDT1000", title: "Data Science", credits: 7.5, status: "planned", notes: "Forecasting", trackTags: ["ENERGY_QUANT"], sortOrder: 0 });
    mockedApi.deleteCourse.mockResolvedValue(undefined);
    const wrapper = await mountApp();
    await goTo("/master");
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
    const wrapper = await mountApp();
    await goTo("/paths");
    await wrapper.get(".company-card .secondary").trigger("click");
    await wrapper.get(".builder .primary").trigger("click");
    await flushPromises();

    expect(mockedApi.createPath).toHaveBeenCalledWith(expect.objectContaining({ name: "Energy Quant-ruten" }));
    expect(wrapper.text()).toContain("Energy Quant-ruten");

    const duplicateButton = wrapper
      .findAll(".actions button.secondary")
      .find((button) => button.text() === "Dupliser");
    expect(duplicateButton).toBeDefined();
    await duplicateButton!.trigger("click");
    await flushPromises();

    expect(mockedApi.createPath).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Energy Quant-ruten kopi" }));
    expect(wrapper.text()).toContain("Energy Quant-ruten kopi");
  });

  it("renders the career board canvas", async () => {
    mockInitialData();
    const wrapper = await mountApp();
    await goTo("/map");
    expect(wrapper.find(".board-shell").exists()).toBe(true);
    expect(wrapper.find(".board-canvas-stub").exists()).toBe(true);
    expect(wrapper.text()).toContain("Karrierekart");
    expect(mockedApi.boards).toHaveBeenCalled();
  });

  it("allows editing and resetting a career track label on the board page", async () => {
    mockInitialData();
    const customLabel = "Energy & Quant (redigert)";
    const resetTrack = careerTrackDefaults.find((track) => track.id === "ENERGY_QUANT")!;
    mockedApi.updateTrack.mockResolvedValue({ ...resetTrack, label: customLabel });
    mockedApi.resetTrack.mockResolvedValue(resetTrack);
    await mountApp();
    await goTo("/map");
    const careerMapStore = useCareerMapStore();
    careerMapStore.openTrackEditor(resetTrack);
    careerMapStore.editingTrackLabel = customLabel;
    await careerMapStore.saveTrackEditor();
    await flushPromises();

    expect(mockedApi.updateTrack).toHaveBeenCalledWith("ENERGY_QUANT", { label: customLabel });
    expect(careerMapStore.trackName("ENERGY_QUANT")).toBe(customLabel);

    careerMapStore.openTrackEditor({ ...resetTrack, label: customLabel });
    await careerMapStore.resetTrackEditor();
    await flushPromises();

    expect(mockedApi.resetTrack).toHaveBeenCalledWith("ENERGY_QUANT");
    expect(careerMapStore.trackName("ENERGY_QUANT")).toBe(resetTrack.label);
  });
});
