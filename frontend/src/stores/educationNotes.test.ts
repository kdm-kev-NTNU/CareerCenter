import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useEducationBooksStore } from "./educationBooks.js";
import { useEducationBachelorStore } from "./educationBachelor.js";
import { useEducationPlatformsStore } from "./educationPlatforms.js";
import { useEducationSelfStudyStore } from "./educationSelfStudy.js";

vi.mock("../api/index.js", () => ({
  api: {
    selfStudyCourses: vi.fn(),
    updateSelfStudyCourse: vi.fn(),
    educationBooks: vi.fn(),
    updateEducationBook: vi.fn(),
    learningPlatforms: vi.fn(),
    updateLearningPlatform: vi.fn(),
    bachelorKnowledge: vi.fn(),
    updateBachelorKnowledge: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("education notes updates", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("updates self-study course notes", async () => {
    const existing = {
      id: "c1",
      title: "Deep Learning",
      provider: "Coursera",
      status: "planned" as const,
      notes: "Old",
      sortOrder: 0
    };
    mockedApi.selfStudyCourses.mockResolvedValue([existing]);
    mockedApi.updateSelfStudyCourse.mockResolvedValue({ ...existing, notes: "New" });

    const store = useEducationSelfStudyStore();
    await store.loadCourses();
    await store.updateCourseNotes("c1", "New");

    expect(mockedApi.updateSelfStudyCourse).toHaveBeenCalledWith("c1", {
      title: "Deep Learning",
      provider: "Coursera",
      status: "planned",
      url: undefined,
      notes: "New",
      completedAt: undefined,
      sortOrder: 0
    });
    expect(store.courses[0]?.notes).toBe("New");
  });

  it("updates book notes", async () => {
    const existing = {
      id: "b1",
      title: "DDIA",
      status: "planned" as const,
      notes: "Old",
      sortOrder: 0
    };
    mockedApi.educationBooks.mockResolvedValue([existing]);
    mockedApi.updateEducationBook.mockResolvedValue({ ...existing, notes: "New" });

    const store = useEducationBooksStore();
    await store.loadBooks();
    await store.updateBookNotes("b1", "New");

    expect(mockedApi.updateEducationBook).toHaveBeenCalledWith("b1", {
      title: "DDIA",
      author: undefined,
      status: "planned",
      url: undefined,
      notes: "New",
      sortOrder: 0
    });
    expect(store.books[0]?.notes).toBe("New");
  });

  it("updates platform notes", async () => {
    const existing = {
      id: "p1",
      name: "Coursera",
      notes: "Old",
      isActive: true,
      sortOrder: 0
    };
    mockedApi.learningPlatforms.mockResolvedValue([existing]);
    mockedApi.updateLearningPlatform.mockResolvedValue({ ...existing, notes: "New" });

    const store = useEducationPlatformsStore();
    await store.loadPlatforms();
    await store.updatePlatformNotes("p1", "New");

    expect(mockedApi.updateLearningPlatform).toHaveBeenCalledWith("p1", {
      name: "Coursera",
      url: undefined,
      notes: "New",
      isActive: true,
      sortOrder: 0
    });
    expect(store.platforms[0]?.notes).toBe("New");
  });

  it("updates bachelor knowledge entry notes", async () => {
    const existing = {
      id: "e1",
      folderId: null,
      courseName: "TDT4120",
      topic: "Graf",
      notes: "Old",
      sortOrder: 0
    };
    mockedApi.bachelorKnowledge.mockResolvedValue([existing]);
    mockedApi.updateBachelorKnowledge.mockResolvedValue({ ...existing, notes: "New" });

    const store = useEducationBachelorStore();
    await store.loadEntries();
    await store.updateEntryNotes("e1", "New");

    expect(mockedApi.updateBachelorKnowledge).toHaveBeenCalledWith("e1", {
      folderId: null,
      courseName: "TDT4120",
      topic: "Graf",
      notes: "New",
      sortOrder: 0
    });
    expect(store.entries[0]?.notes).toBe("New");
  });
});
