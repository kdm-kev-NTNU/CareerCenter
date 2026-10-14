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
    thesisCompanies: vi.fn(),
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
  mockedApi.thesisCompanies.mockResolvedValue([]);
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
    expect(wrapper.text()).not.toContain("Master Plan");
  });

  it("lists internships and graduate programs on one applications page", async () => {
    mockInitialData();
    mockedApi.internships.mockResolvedValue([
      {
        id: "int-1",
        companyName: "Statkraft",
        title: "Summer Intern",
        description: "",
        applicationUrl: "",
        notes: "",
        statusId: "status-1",
        status: { id: "status-1", label: "Interessert", kind: "stage", sortOrder: 0 },
        stageIds: [],
        locationIds: [],
        locations: [],
        trackTags: [],
        requirements: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    mockedApi.graduatePrograms.mockResolvedValue([
      {
        id: "gp-1",
        companyName: "NBIM",
        title: "Technology Graduate",
        description: "",
        applicationUrl: "",
        notes: "",
        statusId: "status-1",
        status: { id: "status-1", label: "Interessert", sortOrder: 0 },
        locationIds: [],
        locations: [],
        trackTags: [],
        requirements: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
    const wrapper = await mountApp("/soknader");
    expect(wrapper.get("aside").text()).toContain("Søknader");
    expect(wrapper.get("aside").text()).not.toContain("Internship");
    expect(wrapper.get("h1").text()).toBe("Søknader");
    expect(wrapper.text()).toContain("Statkraft");
    expect(wrapper.text()).toContain("NBIM");
  });

  it("navigates to primary feature routes from the shell", async () => {
    mockInitialData();
    await mountApp();
    const routes = [
      ["/soknader", "applications"],
      ["/internships", "applications"],
      ["/graduate", "applications"],
      ["/master-thesis", "master-thesis"],
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
