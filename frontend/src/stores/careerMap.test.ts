import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useCareerMapStore } from "./careerMap.js";

vi.mock("../api/index.js", () => ({
  api: {
    updateTrack: vi.fn(),
    resetTrack: vi.fn(),
    deleteTrack: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("useCareerMapStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("opens and clears the track editor", () => {
    const store = useCareerMapStore();
    store.setTracks([{ id: "ENERGY_QUANT", label: "Energy", sortOrder: 0 }]);
    store.openTrackEditor({ id: "ENERGY_QUANT", label: "Energy", sortOrder: 0 });
    expect(store.editingTrackId).toBe("ENERGY_QUANT");
    store.clearTrackEditor();
    expect(store.editingTrackId).toBeNull();
  });

  it("saveTrackEditor updates track settings", async () => {
    mockedApi.updateTrack.mockResolvedValue({ id: "ENERGY_QUANT", label: "Edited", sortOrder: 0 });
    const store = useCareerMapStore();
    store.setTracks([{ id: "ENERGY_QUANT", label: "Energy", sortOrder: 0 }]);
    store.openTrackEditor({ id: "ENERGY_QUANT", label: "Energy", sortOrder: 0 });
    store.editingTrackLabel = "Edited";
    await store.saveTrackEditor();
    expect(store.trackSettings[0].label).toBe("Edited");
    expect(store.editingTrackId).toBeNull();
  });
});
