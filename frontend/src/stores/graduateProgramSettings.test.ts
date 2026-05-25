import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useGraduateProgramSettingsStore } from "./graduateProgramSettings.js";

vi.mock("../api/index.js", () => ({
  api: {
    graduateProgramSettings: vi.fn(),
    createGraduateProgramStatus: vi.fn(),
    updateGraduateProgramStatus: vi.fn(),
    deleteGraduateProgramStatus: vi.fn(),
    createGraduateProgramLocation: vi.fn(),
    updateGraduateProgramLocation: vi.fn(),
    deleteGraduateProgramLocation: vi.fn(),
    createGraduateProgramRequirementType: vi.fn(),
    updateGraduateProgramRequirementType: vi.fn(),
    deleteGraduateProgramRequirementType: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useGraduateProgramSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.graduateProgramSettings.mockResolvedValue({
      statuses: [{ id: "s1", label: "Open", sortOrder: 0 }],
      locations: [{ id: "l1", label: "Oslo", sortOrder: 0 }],
      requirementTypes: [{ id: "r1", label: "CV", description: "", sortOrder: 0 }]
    });
  });

  it("loads and mutates graduate program catalog options", async () => {
    const store = useGraduateProgramSettingsStore();
    await store.loadSettings();

    mockedApi.createGraduateProgramStatus.mockResolvedValue({ id: "s2", label: "New", sortOrder: 1 });
    await store.addStatus("New");
    mockedApi.updateGraduateProgramStatus.mockResolvedValue({ id: "s2", label: "Updated", sortOrder: 1 });
    await store.updateStatus("s2", "Updated");
    mockedApi.deleteGraduateProgramStatus.mockResolvedValue(undefined);
    await store.removeStatus("s2");

    mockedApi.createGraduateProgramLocation.mockResolvedValue({ id: "l2", label: "Trondheim", sortOrder: 1 });
    await store.addLocation("Trondheim");
    mockedApi.updateGraduateProgramLocation.mockResolvedValue({ id: "l2", label: "Trondheim (ny)", sortOrder: 1 });
    await store.updateLocation("l2", "Trondheim (ny)");
    mockedApi.deleteGraduateProgramLocation.mockResolvedValue(undefined);
    await store.removeLocation("l2");

    mockedApi.createGraduateProgramRequirementType.mockResolvedValue({
      id: "r2",
      label: "Portfolio",
      description: "Lenke",
      sortOrder: 1
    });
    await store.addRequirementType("Portfolio", "Lenke");
    mockedApi.updateGraduateProgramRequirementType.mockResolvedValue({
      id: "r2",
      label: "Portfolio (ny)",
      description: "Oppdatert",
      sortOrder: 1
    });
    await store.updateRequirementType("r2", "Portfolio (ny)", "Oppdatert");
    mockedApi.deleteGraduateProgramRequirementType.mockResolvedValue(undefined);
    await store.removeRequirementType("r2");

    expect(store.statuses).toHaveLength(1);
  });
});
