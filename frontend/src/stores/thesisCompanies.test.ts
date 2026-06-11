import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { ThesisCompany } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useThesisCompaniesStore } from "./thesisCompanies.js";

vi.mock("../api/index.js", () => ({
  api: {
    thesisCompanies: vi.fn(),
    createThesisCompany: vi.fn(),
    updateThesisCompany: vi.fn(),
    deleteThesisCompany: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const sampleCompany = (overrides: Partial<ThesisCompany> = {}): ThesisCompany => ({
  id: "thesis-1",
  companyName: "SINTEF",
  topicArea: "Energi og klima",
  status: "known",
  source: "university",
  location: "Trondheim",
  contactPerson: "Ola Nordmann",
  websiteUrl: "https://sintef.no",
  targetSemester: 10,
  trackTags: ["ENERGY_QUANT"],
  notes: "Kjent via veileder",
  sortOrder: 0,
  ...overrides
});

describe("useThesisCompaniesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and filters thesis companies", async () => {
    mockedApi.thesisCompanies.mockResolvedValue([
      sampleCompany(),
      sampleCompany({
        id: "thesis-2",
        companyName: "Equinor",
        topicArea: "Kvant",
        status: "interested",
        source: "network",
        location: "Oslo"
      })
    ]);

    const store = useThesisCompaniesStore();
    await store.loadCompanies();

    store.$patch({ filters: { q: "sintef", status: "", source: "", track: "" } });
    expect(store.filteredCompanies).toHaveLength(1);

    store.$patch({ filters: { q: "", status: "interested", source: "", track: "" } });
    expect(store.filteredCompanies.map((entry) => entry.id)).toEqual(["thesis-2"]);
  });

  it("creates, updates, edits, and deletes thesis companies", async () => {
    mockedApi.thesisCompanies.mockResolvedValue([sampleCompany()]);
    mockedApi.createThesisCompany.mockResolvedValue(sampleCompany({ id: "thesis-new", companyName: "DNB" }));
    mockedApi.updateThesisCompany.mockResolvedValue(sampleCompany({ companyName: "SINTEF Digital" }));
    mockedApi.deleteThesisCompany.mockResolvedValue(undefined);

    const store = useThesisCompaniesStore();
    await store.loadCompanies();

    store.form.companyName = "DNB";
    store.form.websiteUrl = "  https://dnb.no  ";
    await store.saveCompany();
    expect(mockedApi.createThesisCompany).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: "DNB", websiteUrl: "https://dnb.no" })
    );
    expect(store.companies).toHaveLength(2);

    store.startEdit(sampleCompany());
    expect(store.editingId).toBe("thesis-1");
    store.form.companyName = "SINTEF Digital";
    await store.saveCompany();
    expect(mockedApi.updateThesisCompany).toHaveBeenCalledWith(
      "thesis-1",
      expect.objectContaining({ companyName: "SINTEF Digital" })
    );

    store.startEdit(sampleCompany());
    await store.removeCompany("thesis-1");
    expect(store.companies).toHaveLength(1);
    expect(store.editingId).toBeNull();
  });

  it("rejects save without company name", async () => {
    const store = useThesisCompaniesStore();
    store.form.companyName = "   ";
    await expect(store.saveCompany()).rejects.toThrow("Bedriftsnavn er obligatorisk.");
  });

  it("toggles track tags in the form", () => {
    const store = useThesisCompaniesStore();
    store.toggleTrack("ENERGY_QUANT");
    expect(store.form.trackTags).toEqual(["ENERGY_QUANT"]);
    store.toggleTrack("ENERGY_QUANT");
    expect(store.form.trackTags).toEqual([]);
  });
});
