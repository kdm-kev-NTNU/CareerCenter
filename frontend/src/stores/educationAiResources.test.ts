import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { api } from "../api/index.js";
import { useEducationAiResourcesStore } from "./educationAiResources.js";

vi.mock("../api/index.js", () => ({
  api: {
    aiResources: vi.fn(),
    createAiResource: vi.fn(),
    updateAiResource: vi.fn(),
    deleteAiResource: vi.fn(),
    importAiResources: vi.fn(),
    exportAiResources: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const resource = {
  id: "ai-1",
  name: "AGENTS",
  kind: "codex_instruction" as const,
  targetTools: ["codex" as const],
  status: "active" as const,
  tags: ["codex"],
  installPath: "AGENTS.md",
  content: "# Instructions",
  frontmatter: {},
  configFormat: "markdown" as const,
  notes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("useEducationAiResourcesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads, imports, exports, and removes resources", async () => {
    mockedApi.aiResources.mockResolvedValueOnce([]).mockResolvedValueOnce([resource]);
    mockedApi.importAiResources.mockResolvedValue({ created: [resource], updated: [], rejected: [] });
    mockedApi.exportAiResources.mockResolvedValue({
      target: "codex",
      files: [{
        path: "AGENTS.md",
        content: "# Instructions\n",
        resourceIds: ["ai-1"],
        resourceNames: ["AGENTS"],
        writeStrategy: "managed_markdown_block"
      }]
    });
    mockedApi.deleteAiResource.mockResolvedValue(undefined);

    const store = useEducationAiResourcesStore();
    await store.loadResources();
    expect(store.resources).toHaveLength(0);

    store.importFileName = "AGENTS.md";
    store.importContent = "# Instructions";
    await store.importFromText();
    expect(store.resources).toHaveLength(1);
    expect(store.importResult?.created).toHaveLength(1);

    store.exportTarget = "codex";
    await store.exportResources();
    expect(store.exportBundle?.files[0].path).toBe("AGENTS.md");
    expect(store.syncCommand).toContain("--target codex");

    await store.removeResource("ai-1");
    expect(store.resources).toHaveLength(0);
  });
});
