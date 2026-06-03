import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/index.js";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import EducationAiResourcesView from "./EducationAiResourcesView.vue";

vi.mock("../../api/index.js", () => ({
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

describe("EducationAiResourcesView", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    mockedApi.aiResources.mockResolvedValue([]);
  });

  function mountView() {
    return mount(EducationAiResourcesView, {
      global: {
        plugins: [pinia]
      }
    });
  }

  it("shows the auto-load sync command", () => {
    const store = useEducationAiResourcesStore();
    store.exportTarget = "cursor";
    store.syncApiUrl = "http://127.0.0.1:3000";
    store.syncCwd = ".";

    const wrapper = mountView();

    expect(wrapper.text()).toContain("Auto-load / Sync");
    expect(wrapper.find("[data-test='sync-command']").text()).toContain("ai-resource-sync.mjs");
    expect(wrapper.find("[data-test='sync-command']").text()).toContain("--target cursor");
  });

  it("shows rejected import files", async () => {
    mockedApi.importAiResources.mockResolvedValue({
      created: [],
      updated: [],
      rejected: [{ fileName: "broken.mdc", message: "globs is required" }]
    });

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.importFileName = "broken.mdc";
    store.importContent = "---\ndescription: Missing fields\n---\n# Broken";

    await store.importFromText();
    await flushPromises();

    expect(wrapper.find(".import-result").text()).toContain("1 avvist");
    expect(wrapper.find(".import-result").text()).toContain("broken.mdc");
    expect(wrapper.find(".import-result").text()).toContain("globs is required");
  });

  it("lists export files after building a bundle", async () => {
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

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    await store.exportResources();
    await flushPromises();

    expect(wrapper.find(".export-file").text()).toContain("AGENTS.md");
    expect(wrapper.find(".export-file").text()).toContain("Managed Markdown");
  });

  it("creates a resource from the form", async () => {
    mockedApi.createAiResource.mockResolvedValue(cursorRule);

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.newResource.name = "Tailwind";
    store.newResource.content = "# Tailwind";

    await wrapper.find("form.ai-resource-form").trigger("submit.prevent");
    await flushPromises();

    expect(mockedApi.createAiResource).toHaveBeenCalled();
    expect(store.resources).toEqual([cursorRule]);
  });

  it("opens the edit form when clicking edit on a resource card", async () => {
    mockedApi.aiResources.mockResolvedValue([cursorRule]);

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    await store.loadResources();
    await flushPromises();

    await wrapper.find("[data-test='edit-resource']").trigger("click");
    await flushPromises();

    expect(store.editingId).toBe("ai-2");
    expect(wrapper.find("[data-test='edit-resource-form']").exists()).toBe(true);
  });

  it("filters visible resources from the toolbar", async () => {
    mockedApi.aiResources.mockResolvedValue([resource, cursorRule]);

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    await store.loadResources();
    await flushPromises();

    expect(wrapper.findAll(".ai-resource-card")).toHaveLength(2);

    const searchInput = wrapper.find(".ai-resource-toolbar input");
    await searchInput.setValue("Tailwind");
    await flushPromises();

    expect(wrapper.findAll(".ai-resource-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("Tailwind");
  });
});
