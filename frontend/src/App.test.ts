import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { careerTrackDefaults } from "@careercenter/shared";
import App from "./App.vue";
import { authApi } from "./api/auth.js";
import { api } from "./api/index.js";
import router from "./router/index.js";
import { useAppStore } from "./stores/app.js";
import { useAuthStore } from "./stores/auth.js";

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
    updateTrack: vi.fn(),
    resetTrack: vi.fn(),
    courses: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
    competitions: vi.fn(),
    settings: vi.fn(),
    internships: vi.fn(),
    graduateProgramSettings: vi.fn(),
    graduatePrograms: vi.fn(),
    selfStudyCourses: vi.fn(),
    educationBooks: vi.fn(),
    learningPlatforms: vi.fn(),
    aiResources: vi.fn(),
    bachelorKnowledge: vi.fn(),
    bachelorFolderTree: vi.fn(),
    bachelorFiles: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);
const mockedAuthApi = vi.mocked(authApi);

function mockInitialData() {
  mockedApi.tracks.mockResolvedValue(careerTrackDefaults);
  mockedApi.courses.mockResolvedValue([]);
  mockedApi.competitions.mockResolvedValue([]);
  mockedApi.settings.mockResolvedValue({ statuses: [], locations: [], requirementTypes: [] });
  mockedApi.internships.mockResolvedValue([]);
  mockedApi.graduateProgramSettings.mockResolvedValue({ statuses: [], locations: [], requirementTypes: [] });
  mockedApi.graduatePrograms.mockResolvedValue([]);
  mockedApi.selfStudyCourses.mockResolvedValue([]);
  mockedApi.educationBooks.mockResolvedValue([]);
  mockedApi.learningPlatforms.mockResolvedValue([]);
  mockedApi.aiResources.mockResolvedValue([]);
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
  const appStore = useAppStore(pinia);
  if (!appStore.initialized) {
    await appStore.initialize();
  }
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
    mockInitialData();
    const wrapper = await mountApp();
    expect(wrapper.text()).toContain("Dashboard");
    expect(wrapper.text()).toContain("Master Plan");
  });

  it("adds and removes a course from the master plan", async () => {
    mockInitialData();
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

  it("navigates to primary feature routes from the shell", async () => {
    mockInitialData();
    await mountApp();
    const routes = [
      ["/master", "master"],
      ["/internships", "internships"],
      ["/graduate", "graduate"],
      ["/competitions", "competitions"],
      ["/education/kurs", "education-courses"],
      ["/education/boker", "education-books"],
      ["/education/plattformer", "education-platforms"],
      ["/education/bachelor", "education-bachelor"],
      ["/education/ai", "education-ai-resources"]
    ] as const;

    for (const [route, name] of routes) {
      await goTo(route);
      expect(router.currentRoute.value.name).toBe(name);
    }
  });
});
