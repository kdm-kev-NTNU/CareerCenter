import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useEducationPlatformsStore } from "./educationPlatforms.js";

vi.mock("../api/index.js", () => ({
  api: {
    learningPlatforms: vi.fn(),
    createLearningPlatform: vi.fn(),
    deleteLearningPlatform: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useEducationPlatformsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads, adds, and removes platforms", async () => {
    mockedApi.learningPlatforms.mockResolvedValue([]);
    mockedApi.createLearningPlatform.mockResolvedValue({
      id: "p1",
      name: "Coursera",
      notes: "",
      isActive: true,
      sortOrder: 0
    });
    mockedApi.deleteLearningPlatform.mockResolvedValue(undefined);

    const store = useEducationPlatformsStore();
    await store.loadPlatforms();
    store.newPlatform.name = "Coursera";
    await store.addPlatform();
    expect(store.platforms).toHaveLength(1);
    await store.removePlatform("p1");
    expect(store.platforms).toHaveLength(0);
  });
});
