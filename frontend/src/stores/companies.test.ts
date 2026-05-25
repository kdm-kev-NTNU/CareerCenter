import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useCompaniesStore } from "./companies.js";

vi.mock("../api/index.js", () => ({
  api: {
    companies: vi.fn(),
    createCompany: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useCompaniesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads companies with filters", async () => {
    mockedApi.companies.mockResolvedValue([{ id: "c1", name: "Statkraft" } as never]);
    const store = useCompaniesStore();
    store.search = "Stat";
    store.trackFilter = "ENERGY_QUANT";
    store.tierFilter = "1";
    await store.loadCompanies();
    expect(mockedApi.companies).toHaveBeenCalledWith("?q=Stat&track=ENERGY_QUANT&tier=1");
    expect(store.companies).toHaveLength(1);
  });

  it("rejects save when required fields are missing", async () => {
    const store = useCompaniesStore();
    store.resetForm();
    const result = await store.saveCompany();
    expect(result).toBeNull();
    expect(store.error).toContain("påkrevd");
    expect(mockedApi.createCompany).not.toHaveBeenCalled();
  });

  it("toggles tracks without removing the last track", () => {
    const store = useCompaniesStore();
    store.resetForm();
    store.form.tracks = ["ENERGY_QUANT"];
    store.toggleTrack("ENERGY_QUANT");
    expect(store.form.tracks).toEqual(["ENERGY_QUANT"]);
    store.toggleTrack("AI_CONSULTING");
    expect(store.form.tracks).toContain("AI_CONSULTING");
  });

  it("adds and removes role types", () => {
    const store = useCompaniesStore();
    store.roleTypeDraft = "Quant";
    store.addRoleType();
    expect(store.form.roleTypes).toEqual(["Quant"]);
    store.removeRoleType("Quant");
    expect(store.form.roleTypes).toEqual([]);
  });
});
