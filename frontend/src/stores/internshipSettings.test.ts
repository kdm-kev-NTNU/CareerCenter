import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useInternshipSettingsStore } from "./internshipSettings.js";

vi.mock("../api/index.js", () => ({
  api: {
    settings: vi.fn(),
    createStatus: vi.fn(),
    updateStatus: vi.fn(),
    deleteStatus: vi.fn(),
    reorderStatuses: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    createRequirementType: vi.fn(),
    updateRequirementType: vi.fn(),
    deleteRequirementType: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useInternshipSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.settings.mockResolvedValue({
      statuses: [{ id: "s1", label: "Open", kind: "stage", sortOrder: 0 }],
      locations: [{ id: "l1", label: "Oslo", sortOrder: 0 }],
      requirementTypes: [{ id: "r1", label: "CV", description: "", sortOrder: 0 }]
    });
  });

  it("loads and mutates catalog options", async () => {
    const store = useInternshipSettingsStore();
    await store.loadSettings();
    expect(store.statuses).toHaveLength(1);

    mockedApi.createStatus.mockResolvedValue({ id: "s2", label: "New", kind: "stage", sortOrder: 1 });
    await store.addStatus("New");
    expect(store.statuses).toHaveLength(2);

    mockedApi.updateStatus.mockResolvedValue({ id: "s2", label: "Updated", kind: "stage", sortOrder: 1 });
    await store.updateStatus("s2", "Updated");
    expect(store.statuses.find((item) => item.id === "s2")?.label).toBe("Updated");

    mockedApi.reorderStatuses.mockResolvedValue([
      { id: "s2", label: "Updated", kind: "stage", sortOrder: 0 },
      { id: "s1", label: "Open", kind: "stage", sortOrder: 1 }
    ]);
    await store.reorderStatuses(["s2", "s1"]);
    expect(store.statuses.map((item) => item.id)).toEqual(["s2", "s1"]);

    mockedApi.deleteStatus.mockResolvedValue(undefined);
    await store.removeStatus("s2");
    expect(store.statuses).toHaveLength(1);

    mockedApi.createLocation.mockResolvedValue({ id: "l2", label: "Bergen", sortOrder: 1 });
    await store.addLocation("Bergen");
    mockedApi.updateLocation.mockResolvedValue({ id: "l2", label: "Bergen (ny)", sortOrder: 1 });
    await store.updateLocation("l2", "Bergen (ny)");
    mockedApi.deleteLocation.mockResolvedValue(undefined);
    await store.removeLocation("l2");

    mockedApi.createRequirementType.mockResolvedValue({ id: "r2", label: "Motivasjon", description: "Tekst", sortOrder: 1 });
    await store.addRequirementType("Motivasjon", "Tekst");
    mockedApi.updateRequirementType.mockResolvedValue({ id: "r2", label: "Motivasjon (ny)", description: "Oppdatert", sortOrder: 1 });
    await store.updateRequirementType("r2", "Motivasjon (ny)", "Oppdatert");
    mockedApi.deleteRequirementType.mockResolvedValue(undefined);
    await store.removeRequirementType("r2");

    expect(store.locations).toHaveLength(1);
    expect(store.requirementTypes).toHaveLength(1);
  });
});
