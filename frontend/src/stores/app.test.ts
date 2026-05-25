import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useAppStore } from "./app.js";

vi.mock("../api/index.js", () => ({
  api: {
    tracks: vi.fn(),
    companies: vi.fn(),
    courses: vi.fn(),
    paths: vi.fn(),
    competitions: vi.fn(),
    settings: vi.fn(),
    internships: vi.fn(),
    graduateProgramSettings: vi.fn(),
    graduatePrograms: vi.fn(),
    selfStudyCourses: vi.fn(),
    educationBooks: vi.fn(),
    learningPlatforms: vi.fn(),
    bachelorKnowledge: vi.fn(),
    bachelorFolderTree: vi.fn(),
    bachelorFiles: vi.fn(),
    boards: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useAppStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.tracks.mockResolvedValue([]);
    mockedApi.companies.mockResolvedValue([]);
    mockedApi.courses.mockResolvedValue([]);
    mockedApi.paths.mockResolvedValue([]);
    mockedApi.competitions.mockResolvedValue([]);
    mockedApi.settings.mockResolvedValue({ statuses: [], locations: [], requirementTypes: [] });
    mockedApi.internships.mockResolvedValue([]);
    mockedApi.graduateProgramSettings.mockResolvedValue({ statuses: [], locations: [], requirementTypes: [] });
    mockedApi.graduatePrograms.mockResolvedValue([]);
    mockedApi.selfStudyCourses.mockResolvedValue([]);
    mockedApi.educationBooks.mockResolvedValue([]);
    mockedApi.learningPlatforms.mockResolvedValue([]);
    mockedApi.bachelorKnowledge.mockResolvedValue([]);
    mockedApi.bachelorFolderTree.mockResolvedValue([]);
    mockedApi.bachelorFiles.mockResolvedValue([]);
    mockedApi.boards.mockResolvedValue([]);
  });

  it("initialize loads app data and marks initialized", async () => {
    const store = useAppStore();
    await store.initialize();
    expect(store.initialized).toBe(true);
    expect(store.error).toBe("");
  });

  it("initialize stores API errors", async () => {
    mockedApi.tracks.mockRejectedValue(new Error("Network down"));
    const store = useAppStore();
    await store.initialize();
    expect(store.initialized).toBe(false);
    expect(store.error).toBe("Network down");
  });
});
