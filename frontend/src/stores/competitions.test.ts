import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { CompetitionEntry } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useCompetitionsStore } from "./competitions.js";

vi.mock("../api/index.js", () => ({
  api: {
    competitions: vi.fn(),
    createCompetition: vi.fn(),
    updateCompetition: vi.fn(),
    deleteCompetition: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const sampleEntry = (overrides: Partial<CompetitionEntry> = {}): CompetitionEntry => ({
  id: "comp-1",
  title: "Junction",
  type: "hackathon",
  scope: "NORDICS",
  format: "hybrid",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  registrationDeadline: "2026-11-01",
  location: "Helsinki",
  organizer: "Junction",
  url: "https://junction.com",
  status: "watching",
  notes: "Apply early",
  sortOrder: 0,
  ...overrides
});

describe("useCompetitionsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads, filters, groups, and detects upcoming competitions", async () => {
    mockedApi.competitions.mockResolvedValue([
      sampleEntry(),
      sampleEntry({
        id: "comp-2",
        title: "Old Event",
        location: "Oslo",
        registrationDeadline: "2025-01-01",
        scope: "NORWAY",
        type: "case_competition",
        status: "considering"
      }),
      sampleEntry({
        id: "comp-3",
        title: "No Date",
        registrationDeadline: undefined,
        startDate: undefined,
        location: "Remote"
      })
    ]);

    const store = useCompetitionsStore();
    await store.loadCompetitions();

    store.$patch({
      filters: { q: "helsinki", scope: "", type: "", status: "", upcomingOnly: false }
    });
    expect(store.filteredCompetitions).toHaveLength(1);

    store.$patch({ filters: { q: "", scope: "NORWAY", type: "", status: "", upcomingOnly: false } });
    expect(store.filteredCompetitions.map((entry) => entry.id)).toEqual(["comp-2"]);

    store.$patch({
      filters: { q: "", scope: "", type: "hackathon", status: "watching", upcomingOnly: true }
    });
    expect(store.filteredCompetitions.map((entry) => entry.id)).toEqual(["comp-1"]);
    expect(store.upcomingCompetitions.map((entry) => entry.id)).toEqual(["comp-1"]);
    expect(store.isUpcoming(sampleEntry())).toBe(true);
    expect(store.isUpcoming(sampleEntry({ registrationDeadline: "2025-01-01" }))).toBe(false);

    store.$patch({
      filters: { q: "", scope: "", type: "", status: "", upcomingOnly: false }
    });
    const groupedIds = store.groupedByMonth.flatMap((group) => group.items.map((entry) => entry.id));
    expect(groupedIds).toContain("comp-1");
    expect(groupedIds).toContain("comp-2");
  });

  it("creates, updates, edits, and deletes competitions", async () => {
    mockedApi.competitions.mockResolvedValue([sampleEntry()]);
    mockedApi.createCompetition.mockResolvedValue(sampleEntry({ id: "comp-new", title: "New Hack" }));
    mockedApi.updateCompetition.mockResolvedValue(sampleEntry({ title: "Updated Junction" }));
    mockedApi.deleteCompetition.mockResolvedValue(undefined);

    const store = useCompetitionsStore();
    await store.loadCompetitions();

    store.newEntry.title = "New Hack";
    store.newEntry.url = "  https://example.com  ";
    store.newEntry.startDate = "";
    await store.saveEntry();
    expect(mockedApi.createCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New Hack", url: "https://example.com", startDate: null })
    );
    expect(store.competitions).toHaveLength(2);

    store.startEdit(sampleEntry());
    expect(store.editingId).toBe("comp-1");
    store.newEntry.title = "Updated Junction";
    await store.saveEntry();
    expect(mockedApi.updateCompetition).toHaveBeenCalledWith("comp-1", expect.objectContaining({ title: "Updated Junction" }));
    expect(store.competitions[0]?.title).toBe("Updated Junction");

    store.startEdit(sampleEntry());
    await store.removeCompetition("comp-1");
    expect(store.competitions).toHaveLength(1);
    expect(store.editingId).toBeNull();

    store.startEdit(sampleEntry({ id: "comp-left" }));
    await store.removeCompetition("comp-other");
    store.resetForm();
    expect(store.editingId).toBeNull();
    expect(store.newEntry.title).toBe("");
  });
});
