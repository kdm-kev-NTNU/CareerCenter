import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useEducationBooksStore } from "./educationBooks.js";

vi.mock("../api/index.js", () => ({
  api: {
    educationBooks: vi.fn(),
    createEducationBook: vi.fn(),
    deleteEducationBook: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useEducationBooksStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads, adds, and removes books", async () => {
    mockedApi.educationBooks.mockResolvedValue([]);
    mockedApi.createEducationBook.mockResolvedValue({
      id: "b1",
      title: "DDIA",
      status: "planned",
      notes: "",
      sortOrder: 0
    });
    mockedApi.deleteEducationBook.mockResolvedValue(undefined);

    const store = useEducationBooksStore();
    await store.loadBooks();
    store.newBook.title = "DDIA";
    await store.addBook();
    expect(store.books).toHaveLength(1);
    await store.removeBook("b1");
    expect(store.books).toHaveLength(0);
  });
});
