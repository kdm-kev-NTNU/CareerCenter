import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  AiResource,
  AiResourceExportBundle,
  AiResourceExportTarget,
  AiResourceImportResult,
  AiResourceKind,
  AiResourceStatus,
  AiResourceTargetTool
} from "@careercenter/shared";
import { api } from "../api/index.js";
import type { AiResourcePayload } from "../types/index.js";

const defaultFrontmatter = {
  description: "Imported Cursor rule",
  globs: "**/*",
  alwaysApply: false
};

function emptyResource(): AiResourcePayload {
  return {
    name: "",
    kind: "cursor_rule",
    targetTools: ["cursor"],
    status: "draft",
    tags: [],
    installPath: "",
    content: "",
    frontmatter: { ...defaultFrontmatter },
    configFormat: "mdc",
    notes: ""
  };
}

function resourceToPayload(resource: AiResource): AiResourcePayload {
  return {
    name: resource.name,
    kind: resource.kind,
    targetTools: [...resource.targetTools],
    status: resource.status,
    tags: [...resource.tags],
    installPath: resource.installPath,
    content: resource.content,
    frontmatter: structuredClone(resource.frontmatter),
    configFormat: resource.configFormat,
    notes: resource.notes
  };
}

function normalizePayload(payload: AiResourcePayload): AiResourcePayload {
  return {
    ...payload,
    name: payload.name.trim(),
    installPath: payload.installPath.trim(),
    tags: payload.tags.map((tag) => tag.trim()).filter(Boolean),
    targetTools: [...new Set(payload.targetTools)],
    frontmatter: payload.kind === "cursor_rule" && payload.configFormat === "mdc"
      ? { ...defaultFrontmatter, ...payload.frontmatter }
      : payload.frontmatter
  };
}

export const useEducationAiResourcesStore = defineStore("educationAiResources", () => {
  const resources = ref<AiResource[]>([]);
  const newResource = ref<AiResourcePayload>(emptyResource());
  const tagInput = ref("");
  const editingId = ref<string | null>(null);
  const editingResource = ref<AiResourcePayload | null>(null);
  const editingTagInput = ref("");
  const importFileName = ref("AGENTS.md");
  const importContent = ref("");
  const importResult = ref<AiResourceImportResult | null>(null);
  const importError = ref("");
  const exportTarget = ref<AiResourceExportTarget>("all");
  const exportBundle = ref<AiResourceExportBundle | null>(null);
  const exportError = ref("");
  const syncScriptPath = ref("scripts/ai-resource-sync.mjs");
  const syncApiUrl = ref(defaultApiUrl());
  const syncCwd = ref(".");
  const filterTarget = ref<"all" | AiResourceTargetTool>("all");
  const filterKind = ref<"all" | AiResourceKind>("all");
  const filterStatus = ref<"all" | AiResourceStatus>("all");
  const search = ref("");

  const filteredResources = computed(() => {
    const query = search.value.trim().toLowerCase();
    return resources.value
      .filter((resource) => filterTarget.value === "all" || resource.targetTools.includes(filterTarget.value))
      .filter((resource) => filterKind.value === "all" || resource.kind === filterKind.value)
      .filter((resource) => filterStatus.value === "all" || resource.status === filterStatus.value)
      .filter((resource) => {
        if (!query) return true;
        return [
          resource.name,
          resource.kind,
          resource.status,
          resource.installPath,
          resource.notes,
          resource.content,
          ...resource.tags,
          ...resource.targetTools
        ].join(" ").toLowerCase().includes(query);
      });
  });

  const tagOptions = computed(() =>
    [...new Set(resources.value.flatMap((resource) => resource.tags))].sort((a, b) => a.localeCompare(b))
  );

  const syncCommand = computed(() => [
    "node",
    shellQuote(syncScriptPath.value.trim() || "scripts/ai-resource-sync.mjs"),
    "--api-url",
    shellQuote(syncApiUrl.value.trim() || "http://127.0.0.1:3000"),
    "--target",
    exportTarget.value,
    "--cwd",
    shellQuote(syncCwd.value.trim() || "."),
    "--yes"
  ].join(" "));

  async function loadResources() {
    resources.value = await api.aiResources();
  }

  async function addResource() {
    const payload = normalizePayload({
      ...newResource.value,
      tags: [...newResource.value.tags, ...splitTags(tagInput.value)]
    });
    const created = await api.createAiResource(payload);
    resources.value = [created, ...resources.value];
    newResource.value = emptyResource();
    tagInput.value = "";
  }

  function startEdit(resource: AiResource) {
    editingId.value = resource.id;
    editingResource.value = resourceToPayload(resource);
    editingTagInput.value = "";
  }

  function cancelEdit() {
    editingId.value = null;
    editingResource.value = null;
    editingTagInput.value = "";
  }

  async function saveEdit() {
    if (!editingId.value || !editingResource.value) return;
    const payload = normalizePayload({
      ...editingResource.value,
      tags: [...editingResource.value.tags, ...splitTags(editingTagInput.value)]
    });
    const updated = await api.updateAiResource(editingId.value, payload);
    const index = resources.value.findIndex((resource) => resource.id === updated.id);
    if (index >= 0) resources.value[index] = updated;
    cancelEdit();
  }

  async function removeResource(id: string) {
    await api.deleteAiResource(id);
    resources.value = resources.value.filter((resource) => resource.id !== id);
  }

  async function importFromText() {
    importError.value = "";
    importResult.value = null;
    try {
      const result = await api.importAiResources({
        files: [{ fileName: importFileName.value.trim(), content: importContent.value }]
      });
      importResult.value = result;
      await loadResources();
      if (!result.rejected.length) {
        importContent.value = "";
      }
    } catch (caught) {
      importError.value = caught instanceof Error ? caught.message : "Kunne ikke importere ressurs.";
    }
  }

  async function importFiles(files: FileList) {
    importError.value = "";
    importResult.value = null;
    try {
      const payload = await Promise.all(
        [...files].map(async (file) => ({ fileName: file.name, content: await file.text() }))
      );
      importResult.value = await api.importAiResources({ files: payload });
      await loadResources();
    } catch (caught) {
      importError.value = caught instanceof Error ? caught.message : "Kunne ikke importere filer.";
    }
  }

  async function exportResources() {
    exportError.value = "";
    exportBundle.value = null;
    try {
      exportBundle.value = await api.exportAiResources(exportTarget.value);
    } catch (caught) {
      exportError.value = caught instanceof Error ? caught.message : "Kunne ikke eksportere ressurser.";
    }
  }

  function addTarget(payload: AiResourcePayload, tool: AiResourceTargetTool) {
    if (!payload.targetTools.includes(tool)) payload.targetTools.push(tool);
  }

  function removeTarget(payload: AiResourcePayload, tool: AiResourceTargetTool) {
    payload.targetTools = payload.targetTools.filter((target) => target !== tool);
    if (!payload.targetTools.length) payload.targetTools = [tool];
  }

  function removeTag(payload: AiResourcePayload, tag: string) {
    payload.tags = payload.tags.filter((item) => item !== tag);
  }

  return {
    resources,
    filteredResources,
    tagOptions,
    newResource,
    tagInput,
    editingId,
    editingResource,
    editingTagInput,
    importFileName,
    importContent,
    importResult,
    importError,
    exportTarget,
    exportBundle,
    exportError,
    syncScriptPath,
    syncApiUrl,
    syncCwd,
    syncCommand,
    filterTarget,
    filterKind,
    filterStatus,
    search,
    loadResources,
    addResource,
    startEdit,
    cancelEdit,
    saveEdit,
    removeResource,
    importFromText,
    importFiles,
    exportResources,
    addTarget,
    removeTarget,
    removeTag
  };
});

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function defaultApiUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  const host = window.location.hostname || "127.0.0.1";
  return `${window.location.protocol}//${host}:3000`;
}

function shellQuote(value: string) {
  return /\s/.test(value) ? `"${value.replace(/"/g, "\\\"")}"` : value;
}
