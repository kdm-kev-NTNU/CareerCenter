import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { GraduateProgram } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useGraduateProgramSettingsStore } from "./graduateProgramSettings.js";
import { useGraduateProgramsStore } from "./graduatePrograms.js";

vi.mock("../api/index.js", () => ({
  api: {
    graduatePrograms: vi.fn(),
    createGraduateProgram: vi.fn(),
    updateGraduateProgram: vi.fn(),
    deleteGraduateProgram: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const sampleProgram = (overrides: Partial<GraduateProgram> = {}): GraduateProgram => ({
  id: "gp-1",
  companyName: "NBIM",
  title: "Technology Graduate",
  description: "",
  applicationUrl: "",
  notes: "",
  statusId: "status-1",
  status: { id: "status-1", label: "Interessert", sortOrder: 0 },
  locationIds: ["loc-1"],
  locations: [{ id: "loc-1", label: "Oslo", sortOrder: 0 }],
  trackTags: ["INVESTMENT_TECH"],
  requirements: [
    {
      id: "req-item-1",
      requirementTypeId: "req-1",
      label: "CV",
      description: "",
      isRequired: true,
      isDone: true,
      notes: ""
    }
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

function seedSettings() {
  const settings = useGraduateProgramSettingsStore();
  settings.$patch({
    statuses: [{ id: "status-1", label: "Interessert", sortOrder: 0 }],
    locations: [{ id: "loc-1", label: "Oslo", sortOrder: 0 }],
    requirementTypes: [{ id: "req-1", label: "CV", description: "CV", sortOrder: 0 }]
  });
}

describe("useGraduateProgramsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedSettings();
    vi.clearAllMocks();
  });

  it("throws when saving with missing required fields", async () => {
    const store = useGraduateProgramsStore();
    store.resetForm();
    await expect(store.saveGraduateProgram()).rejects.toThrow("Bedriftsnavn, programnavn og status er obligatorisk.");
    expect(mockedApi.createGraduateProgram).not.toHaveBeenCalled();
  });

  it("resetForm restores defaults from settings", () => {
    const store = useGraduateProgramsStore();
    store.form.companyName = "Test";
    store.form.title = "Changed";
    store.resetForm();
    expect(store.form.companyName).toBe("");
    expect(store.form.statusId).toBe("status-1");
    expect(store.form.requirements).toHaveLength(1);
    expect(store.isEditing).toBe(false);
  });

  it("startEdit populates form from program", () => {
    const store = useGraduateProgramsStore();
    store.startEdit(sampleProgram());
    expect(store.isEditing).toBe(true);
    expect(store.form.companyName).toBe("NBIM");
    expect(store.form.title).toBe("Technology Graduate");
    expect(store.form.deadline).toBeNull();
    expect(store.form.locationIds).toEqual(["loc-1"]);
  });

  it("toggleLocation and toggleTrack update form selections", () => {
    const store = useGraduateProgramsStore();
    store.resetForm();
    store.toggleLocation("loc-1");
    expect(store.form.locationIds).toEqual(["loc-1"]);
    store.toggleLocation("loc-1");
    expect(store.form.locationIds).toEqual([]);
    store.toggleTrack("INVESTMENT_TECH");
    expect(store.form.trackTags).toEqual(["INVESTMENT_TECH"]);
  });

  it("progressLabel reports completed required requirements", () => {
    const store = useGraduateProgramsStore();
    expect(store.progressLabel(sampleProgram())).toBe("1/1 krav fullført");
  });

  it("creates a graduate program via API", async () => {
    mockedApi.createGraduateProgram.mockResolvedValue(sampleProgram({ id: "gp-new" }));
    const store = useGraduateProgramsStore();
    store.resetForm();
    store.form.companyName = "DNB";
    store.form.title = "Graduate";
    await store.saveGraduateProgram();
    expect(mockedApi.createGraduateProgram).toHaveBeenCalledTimes(1);
    expect(store.graduatePrograms[0]?.id).toBe("gp-new");
    expect(store.isSubmitting).toBe(false);
  });
});
