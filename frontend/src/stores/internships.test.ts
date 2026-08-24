import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Internship } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useInternshipSettingsStore } from "./internshipSettings.js";
import { useInternshipsStore } from "./internships.js";

vi.mock("../api/index.js", () => ({
  api: {
    internships: vi.fn(),
    createInternship: vi.fn(),
    updateInternship: vi.fn(),
    deleteInternship: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const sampleInternship = (overrides: Partial<Internship> = {}): Internship => ({
  id: "int-1",
  companyName: "Statkraft",
  title: "Summer Intern",
  description: "",
  applicationUrl: "",
  notes: "",
  statusId: "status-1",
  status: { id: "status-1", label: "Interessert", kind: "stage", sortOrder: 0 },
  stageIds: ["status-1"],
  locationIds: ["loc-1"],
  locations: [{ id: "loc-1", label: "Oslo", sortOrder: 0 }],
  trackTags: ["ENERGY_QUANT"],
  requirements: [
    {
      id: "req-item-1",
      requirementTypeId: "req-1",
      label: "CV",
      description: "",
      isRequired: true,
      isDone: false,
      notes: ""
    }
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

function seedSettings() {
  const settings = useInternshipSettingsStore();
  settings.$patch({
    statuses: [
      { id: "status-1", label: "Interessert", kind: "stage", sortOrder: 0 },
      { id: "status-2", label: "Case", kind: "stage", sortOrder: 1 },
      { id: "status-3", label: "Tilbud", kind: "outcome", sortOrder: 2 }
    ],
    locations: [{ id: "loc-1", label: "Oslo", sortOrder: 0 }],
    requirementTypes: [{ id: "req-1", label: "CV", description: "CV", sortOrder: 0 }]
  });
}

describe("useInternshipsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedSettings();
    vi.clearAllMocks();
  });

  it("throws when saving with missing required fields", async () => {
    const store = useInternshipsStore();
    store.resetForm();
    await expect(store.saveInternship()).rejects.toThrow("Bedriftsnavn, stillingstittel og status er obligatorisk.");
    expect(mockedApi.createInternship).not.toHaveBeenCalled();
  });

  it("resetForm restores defaults from settings", () => {
    const store = useInternshipsStore();
    store.form.companyName = "Test";
    store.form.title = "Changed";
    store.resetForm();
    expect(store.form.companyName).toBe("");
    expect(store.form.statusId).toBe("status-1");
    expect(store.form.stageIds).toEqual(["status-1", "status-2"]);
    expect(store.form.requirements).toHaveLength(1);
    expect(store.isEditing).toBe(false);
  });

  it("startEdit populates form from internship", () => {
    const store = useInternshipsStore();
    store.startEdit(sampleInternship({ deadline: "2026-08-15T00:00:00.000Z" }));
    expect(store.isEditing).toBe(true);
    expect(store.form.companyName).toBe("Statkraft");
    expect(store.form.title).toBe("Summer Intern");
    expect(store.form.deadline).toBe("2026-08-15");
    expect(store.form.locationIds).toEqual(["loc-1"]);
    expect(store.form.stageIds).toEqual(["status-1"]);
  });

  it("toggleLocation and toggleTrack update form selections", () => {
    const store = useInternshipsStore();
    store.resetForm();
    store.toggleLocation("loc-1");
    expect(store.form.locationIds).toEqual(["loc-1"]);
    store.toggleLocation("loc-1");
    expect(store.form.locationIds).toEqual([]);
    store.toggleTrack("ENERGY_QUANT");
    expect(store.form.trackTags).toEqual(["ENERGY_QUANT"]);
  });

  it("toggleStage and moveStage customize the internship pipeline", () => {
    const store = useInternshipsStore();
    store.resetForm();
    expect(store.form.stageIds).toEqual(["status-1", "status-2"]);
    store.toggleStage("status-2");
    expect(store.form.stageIds).toEqual(["status-1"]);
    store.toggleStage("status-2");
    expect(store.form.stageIds).toEqual(["status-1", "status-2"]);
    store.moveStage("status-2", -1);
    expect(store.form.stageIds).toEqual(["status-2", "status-1"]);
  });

  it("progressLabel reports completed required requirements", () => {
    const store = useInternshipsStore();
    expect(store.progressLabel(sampleInternship())).toBe("0/1 krav fullført");
  });

  it("creates an internship via API", async () => {
    mockedApi.createInternship.mockResolvedValue(sampleInternship({ id: "int-new" }));
    const store = useInternshipsStore();
    store.resetForm();
    store.form.companyName = "DNB";
    store.form.title = "Intern";
    await store.saveInternship();
    expect(mockedApi.createInternship).toHaveBeenCalledTimes(1);
    expect(store.internships[0]?.id).toBe("int-new");
    expect(store.isSubmitting).toBe(false);
  });
});
