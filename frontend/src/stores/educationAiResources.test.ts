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

const cursorRule = {
  id: "ai-2",
  name: "Tailwind",
  kind: "cursor_rule" as const,
  targetTools: ["cursor" as const],
  status: "draft" as const,
  tags: ["tailwind"],
  installPath: ".cursor/rules/tailwind.mdc",
  content: "# Tailwind",
  frontmatter: { description: "Tailwind", globs: "**/*.vue", alwaysApply: false },
  configFormat: "mdc" as const,
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

  it("creates and updates resources with normalized payloads", async () => {
    mockedApi.aiResources.mockResolvedValue([]);
    mockedApi.createAiResource.mockResolvedValue(cursorRule);
    mockedApi.updateAiResource.mockResolvedValue({ ...cursorRule, status: "active" });

    const store = useEducationAiResourcesStore();
    store.newResource.name = "  Tailwind  ";
    store.newResource.installPath = " .cursor/rules/tailwind.mdc ";
    store.newResource.tags = ["tailwind"];
    store.tagInput = "rules, ";
    store.newResource.frontmatter = { description: "Custom", globs: "**/*.vue", alwaysApply: false };

    await store.addResource();
    expect(mockedApi.createAiResource).toHaveBeenCalledWith(expect.objectContaining({
      name: "Tailwind",
      installPath: ".cursor/rules/tailwind.mdc",
      tags: ["tailwind", "rules"],
      frontmatter: expect.objectContaining({ description: "Custom", globs: "**/*.vue" })
    }));
    expect(store.resources[0]).toEqual(cursorRule);

    store.startEdit(cursorRule);
    store.editingResource!.status = "active";
    await store.saveEdit();
    expect(mockedApi.updateAiResource).toHaveBeenCalledWith("ai-2", expect.objectContaining({ status: "active" }));
    expect(store.editingId).toBeNull();
  });

  it("filters resources by search, kind, status, and target", async () => {
    mockedApi.aiResources.mockResolvedValue([resource, cursorRule]);

    const store = useEducationAiResourcesStore();
    await store.loadResources();
    expect(store.filteredResources).toHaveLength(2);

    store.filterTarget = "codex";
    expect(store.filteredResources).toEqual([resource]);

    store.filterTarget = "all";
    store.filterKind = "cursor_rule";
    expect(store.filteredResources).toEqual([cursorRule]);

    store.filterKind = "all";
    store.filterStatus = "draft";
    expect(store.filteredResources).toEqual([cursorRule]);

    store.filterStatus = "all";
    store.search = "agents";
    expect(store.filteredResources).toEqual([resource]);
  });

  it("imports multiple files from a FileList", async () => {
    mockedApi.importAiResources.mockResolvedValue({
      created: [resource, cursorRule],
      updated: [],
      rejected: []
    });

    const store = useEducationAiResourcesStore();
    const fileOne = Object.assign(new File(["# Instructions"], "AGENTS.md", { type: "text/plain" }), {
      text: async () => "# Instructions"
    });
    const fileTwo = Object.assign(new File(["# Tailwind"], "tailwind.mdc", { type: "text/plain" }), {
      text: async () => "# Tailwind"
    });

    await store.importFiles([fileOne, fileTwo] as unknown as FileList);
    expect(mockedApi.importAiResources).toHaveBeenCalledWith({
      files: [
        { fileName: "AGENTS.md", content: "# Instructions" },
        { fileName: "tailwind.mdc", content: "# Tailwind" }
      ]
    });
    expect(store.importResult?.created).toHaveLength(2);
  });
});
