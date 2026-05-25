import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useEducationSelfStudyStore } from "./educationSelfStudy.js";

vi.mock("../api/index.js", () => ({
  api: {
    selfStudyCourses: vi.fn(),
    createSelfStudyCourse: vi.fn(),
    deleteSelfStudyCourse: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useEducationSelfStudyStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads, adds, and removes self-study courses", async () => {
    mockedApi.selfStudyCourses.mockResolvedValue([]);
    mockedApi.createSelfStudyCourse.mockResolvedValue({
      id: "c1",
      title: "FastAPI",
      provider: "YouTube",
      status: "planned",
      url: "",
      notes: "",
      sortOrder: 0
    });
    mockedApi.deleteSelfStudyCourse.mockResolvedValue(undefined);

    const store = useEducationSelfStudyStore();
    await store.loadCourses();
    store.newCourse.title = "FastAPI";
    store.newCourse.provider = "YouTube";
    await store.addCourse();
    expect(store.courses).toHaveLength(1);
    await store.removeCourse("c1");
    expect(store.courses).toHaveLength(0);
  });
});
