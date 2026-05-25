import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useCoursesStore } from "./courses.js";

vi.mock("../api/index.js", () => ({
  api: {
    courses: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useCoursesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads and mutates courses", async () => {
    mockedApi.courses.mockResolvedValue([]);
    mockedApi.createCourse.mockResolvedValue({
      id: "c1",
      semester: 7,
      courseCode: "TDT4173",
      title: "ML",
      credits: 7.5,
      status: "planned",
      notes: "",
      trackTags: ["ENERGY_QUANT"],
      sortOrder: 0
    });
    mockedApi.deleteCourse.mockResolvedValue(undefined);

    const store = useCoursesStore();
    await store.loadCourses();
    store.newCourse.courseCode = "TDT4173";
    store.newCourse.title = "ML";
    await store.addCourse();
    expect(store.courses).toHaveLength(1);
    await store.removeCourse("c1");
    expect(store.courses).toHaveLength(0);
  });
});
