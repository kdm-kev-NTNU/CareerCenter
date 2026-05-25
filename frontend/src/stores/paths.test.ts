import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { CareerPath, Company } from "@careercenter/shared";
import { api } from "../api/index.js";
import { usePathsStore } from "./paths.js";

vi.mock("../api/index.js", () => ({
  api: {
    paths: vi.fn(),
    createPath: vi.fn(),
    updatePath: vi.fn(),
    deletePath: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const company = (id: string): Company =>
  ({ id, name: id, description: "", tracks: ["ENERGY_QUANT"], tier: 1, geography: "Oslo", roleTypes: [], difficulty: "Medium", upside: "High", relevanceScore: 0 }) as Company;

describe("usePathsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("adds and removes companies from the draft path", () => {
    const store = usePathsStore();
    store.addToPath(company("a"));
    store.addToPath(company("a"));
    expect(store.selectedCompanies).toHaveLength(1);
    store.removeFromPath("a");
    expect(store.selectedCompanies).toHaveLength(0);
  });

  it("savePath creates a path from selected companies", async () => {
    mockedApi.createPath.mockResolvedValue({ id: "p1", name: "Energy Quant-ruten" } as CareerPath);
    const store = usePathsStore();
    store.addToPath(company("statkraft"));
    await store.savePath();
    expect(mockedApi.createPath).toHaveBeenCalled();
    expect(store.paths[0].id).toBe("p1");
  });

  it("does not save when no companies are selected", async () => {
    const store = usePathsStore();
    await store.savePath();
    expect(mockedApi.createPath).not.toHaveBeenCalled();
  });

  it("duplicates an existing path", async () => {
    const path = {
      id: "p1",
      name: "Energy",
      description: "",
      targetRole: "Quant",
      horizon: "5y",
      steps: [{ id: "s1", companyId: "c1", order: 0, note: "", targetRole: "Quant", company: company("c1") }],
      createdAt: "",
      updatedAt: ""
    } as CareerPath;
    mockedApi.createPath.mockResolvedValue({ ...path, id: "p2", name: "Energy kopi" });
    const store = usePathsStore();
    store.paths = [path];
    await store.duplicatePath(path);
    expect(store.paths[0].id).toBe("p2");
  });

  it("renames and removes paths", async () => {
    const path = {
      id: "p1",
      name: "Energy",
      description: "",
      targetRole: "Quant",
      horizon: "5y",
      steps: [],
      createdAt: "",
      updatedAt: ""
    } as CareerPath;
    mockedApi.updatePath.mockResolvedValue({ ...path, name: "Energy 2" });
    mockedApi.deletePath.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));

    const store = usePathsStore();
    store.paths = [path];
    await store.renamePath("p1", "Energy 2");
    expect(store.paths[0].name).toBe("Energy 2");

    await store.removePath("p1");
    expect(store.paths).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
