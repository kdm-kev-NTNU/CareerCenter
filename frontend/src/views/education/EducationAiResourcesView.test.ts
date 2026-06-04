import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/index.js";
import { useAppStore } from "../../stores/app.js";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import EducationAiResourcesView from "./EducationAiResourcesView.vue";

vi.mock("../../api/index.js", () => ({
  api: {
    aiResources: vi.fn(),
    createAiResource: vi.fn(),
    updateAiResource: vi.fn(),
    deleteAiResource: vi.fn(),
    importAiResources: vi.fn(),
    exportAiResources: vi.fn(),
    syncAiResources: vi.fn(),
    scanAiResources: vi.fn()
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

  it("shows the scan and sync panel with pick folder button", () => {
    const store = useEducationAiResourcesStore();
    store.syncCwd = "C:\\project";

    const wrapper = mountView();

    expect(wrapper.text()).toContain("Skann og synk");
    expect(wrapper.find("[data-test='pick-folder']").exists()).toBe(true);
    expect(wrapper.find("[data-test='run-scan']").exists()).toBe(true);
    expect(wrapper.find("[data-test='run-sync']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Skann prosjekt");
    expect(wrapper.text()).toContain("Synk til prosjekt");
    expect(wrapper.text()).toContain("Velg mappe");
  });

  it("enables scan after folder label is set", async () => {
    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.syncFolderLabel = "CareerCenter";
    store.pickedFolderFiles = [new File(["# Agents"], "AGENTS.md")];
    await flushPromises();

    expect(store.hasProjectFolder).toBe(true);
    expect(wrapper.find("[data-test='run-scan']").attributes("disabled")).toBeUndefined();
  });

  it("shows sync result after runSync", async () => {
    mockedApi.syncAiResources.mockResolvedValue({
      dryRun: false,
      target: "cursor",
      cwd: "C:\\project",
      files: [{ path: ".cursor/rules/tailwind.mdc", action: "create", writeStrategy: "replace" }],
      conflicts: [],
      rejected: []
    });

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.syncCwd = "C:\\project";
    await store.runSync();
    await flushPromises();

    expect(wrapper.find("[data-test='sync-result']").text()).toContain("tailwind.mdc");
    expect(wrapper.find("[data-test='sync-result']").text()).toContain("Opprettet");
  });

  it("shows scan result after runScan", async () => {
    mockedApi.scanAiResources.mockResolvedValue({
      created: [cursorRule],
      updated: [],
      rejected: [],
      scanned: 3
    });
    mockedApi.aiResources.mockResolvedValue([cursorRule]);

    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.syncCwd = "C:\\project";
    await store.runScan();
    await flushPromises();

    expect(wrapper.find("[data-test='scan-result']").text()).toContain("3 filer");
    expect(wrapper.find("[data-test='scan-result']").text()).toContain("1 nye");
  });

  it("shows success message from store", async () => {
    const wrapper = mountView();
    const store = useEducationAiResourcesStore();
    store.successMessage = "Ressurs lagt til.";
    await flushPromises();
    expect(wrapper.find("[data-test='success-message']").text()).toContain("Ressurs lagt til.");
  });

  it("shows loading label while app initializes", async () => {
    const wrapper = mountView();
    const appStore = useAppStore();
    appStore.isInitializing = true;
    await flushPromises();
    expect(wrapper.find("[data-test='ai-resources-loading']").text()).toContain("Laster AI-ressurser");
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
