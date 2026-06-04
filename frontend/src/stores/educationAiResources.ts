import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  AiResource,
  AiResourceExportBundle,
  AiResourceExportTarget,
  AiResourceImportResult,
  AiResourceScanResult,
  AiResourceSyncResult,
  AiResourceKind,
  AiResourceStatus,
  AiResourceTargetTool
} from "@careercenter/shared";
import { api } from "../api/index.js";
import {
  chunkImportFiles,
  collectFilesFromDirectoryHandle,
  filesFromDirectoryInput,
  readDiscoveredFiles
} from "../lib/aiResourceDiscovery.js";
import { writeBundleToDirectory } from "../lib/aiResourceFolderSync.js";
import type { AiResourcePayload } from "../types/index.js";

const SUCCESS_MESSAGE_MS = 2400;

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

function cloneFrontmatter(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
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
    frontmatter: cloneFrontmatter(resource.frontmatter),
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

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

export type SyncConnectionStatus = "idle" | "checking" | "ok" | "error";

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
  const syncFolderLabel = ref("");
  const projectDirectoryHandle = ref<FileSystemDirectoryHandle | null>(null);
  const pickedFolderFiles = ref<File[]>([]);
  const filterTarget = ref<"all" | AiResourceTargetTool>("all");
  const filterKind = ref<"all" | AiResourceKind>("all");
  const filterStatus = ref<"all" | AiResourceStatus>("all");
  const search = ref("");

  const isSaving = ref(false);
  const deletingId = ref<string | null>(null);
  const isImporting = ref(false);
  const isExporting = ref(false);
  const saveError = ref("");
  const editError = ref("");
  const deleteError = ref("");
  const successMessage = ref("");
  const syncConnectionStatus = ref<SyncConnectionStatus>("idle");
  const syncConnectionMessage = ref("");
  const syncForce = ref(false);
  const isSyncing = ref(false);
  const syncError = ref("");
  const syncResult = ref<AiResourceSyncResult | null>(null);
  const isScanning = ref(false);
  const scanError = ref("");
  const scanResult = ref<AiResourceScanResult | null>(null);

  let successTimeout: ReturnType<typeof setTimeout> | undefined;

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

  const hasProjectFolder = computed(() =>
    Boolean(syncCwd.value.trim() || projectDirectoryHandle.value || pickedFolderFiles.value.length)
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

  const syncDryRunCommand = computed(() => syncCommand.value.replace(/\s--yes$/, ""));

  function showSuccess(message: string) {
    successMessage.value = message;
    if (successTimeout) clearTimeout(successTimeout);
    successTimeout = setTimeout(() => {
      successMessage.value = "";
    }, SUCCESS_MESSAGE_MS);
  }

  function clearSuccess() {
    successMessage.value = "";
    if (successTimeout) {
      clearTimeout(successTimeout);
      successTimeout = undefined;
    }
  }

  async function loadResources() {
    resources.value = await api.aiResources();
  }

  async function addResource() {
    isSaving.value = true;
    saveError.value = "";
    clearSuccess();
    try {
      const payload = normalizePayload({
        ...newResource.value,
        tags: [...newResource.value.tags, ...splitTags(tagInput.value)]
      });
      const created = await api.createAiResource(payload);
      resources.value = [created, ...resources.value];
      newResource.value = emptyResource();
      tagInput.value = "";
      showSuccess("Ressurs lagt til.");
    } catch (caught) {
      saveError.value = errorMessage(caught, "Kunne ikke legge til ressurs.");
    } finally {
      isSaving.value = false;
    }
  }

  function startEdit(resource: AiResource) {
    editingId.value = resource.id;
    editingResource.value = resourceToPayload(resource);
    editingTagInput.value = "";
    editError.value = "";
  }

  function cancelEdit() {
    editingId.value = null;
    editingResource.value = null;
    editingTagInput.value = "";
    editError.value = "";
  }

  async function saveEdit() {
    if (!editingId.value || !editingResource.value) return;
    isSaving.value = true;
    editError.value = "";
    clearSuccess();
    try {
      const payload = normalizePayload({
        ...editingResource.value,
        tags: [...editingResource.value.tags, ...splitTags(editingTagInput.value)]
      });
      const updated = await api.updateAiResource(editingId.value, payload);
      const index = resources.value.findIndex((resource) => resource.id === updated.id);
      if (index >= 0) resources.value[index] = updated;
      cancelEdit();
      showSuccess("Endringer lagret.");
    } catch (caught) {
      editError.value = errorMessage(caught, "Kunne ikke lagre endringer.");
    } finally {
      isSaving.value = false;
    }
  }

  async function removeResource(id: string) {
    deletingId.value = id;
    deleteError.value = "";
    clearSuccess();
    try {
      await api.deleteAiResource(id);
      resources.value = resources.value.filter((resource) => resource.id !== id);
      if (editingId.value === id) cancelEdit();
      showSuccess("Ressurs slettet.");
    } catch (caught) {
      deleteError.value = errorMessage(caught, "Kunne ikke slette ressurs.");
    } finally {
      deletingId.value = null;
    }
  }

  async function importFromText() {
    importError.value = "";
    importResult.value = null;
    isImporting.value = true;
    clearSuccess();
    try {
      const result = await api.importAiResources({
        files: [{ fileName: importFileName.value.trim(), content: importContent.value }]
      });
      importResult.value = result;
      await loadResources();
      if (!result.rejected.length) {
        importContent.value = "";
      }
      const parts = [
        result.created.length ? `${result.created.length} opprettet` : "",
        result.updated.length ? `${result.updated.length} oppdatert` : ""
      ].filter(Boolean);
      showSuccess(parts.length ? `Import ferdig: ${parts.join(", ")}.` : "Import fullført.");
    } catch (caught) {
      importError.value = errorMessage(caught, "Kunne ikke importere ressurs.");
    } finally {
      isImporting.value = false;
    }
  }

  async function importFiles(files: FileList) {
    importError.value = "";
    importResult.value = null;
    isImporting.value = true;
    clearSuccess();
    try {
      const payload = await Promise.all(
        [...files].map(async (file) => ({
          fileName: file.webkitRelativePath
            ? file.webkitRelativePath.replace(/\\/g, "/").split("/").slice(1).join("/") || file.name
            : file.name,
          content: await file.text()
        }))
      );
      importResult.value = await api.importAiResources({ files: payload });
      await loadResources();
      showSuccess(`${files.length} fil(er) importert.`);
    } catch (caught) {
      importError.value = errorMessage(caught, "Kunne ikke importere filer.");
    } finally {
      isImporting.value = false;
    }
  }

  async function importDiscoveredFiles(files: Array<{ fileName: string; content: string }>) {
    const aggregated: AiResourceScanResult = {
      created: [],
      updated: [],
      rejected: [],
      scanned: files.length
    };

    if (!files.length) {
      return aggregated;
    }

    for (const batch of chunkImportFiles(files)) {
      const result = await api.importAiResources({ files: batch });
      aggregated.created.push(...result.created);
      aggregated.updated.push(...result.updated);
      aggregated.rejected.push(...result.rejected);
    }

    return aggregated;
  }

  function applyScanFeedback(result: AiResourceScanResult) {
    scanResult.value = result;
    const parts = [
      result.created.length ? `${result.created.length} nye` : "",
      result.updated.length ? `${result.updated.length} oppdatert` : ""
    ].filter(Boolean);
    if (parts.length) {
      showSuccess(`Skanning ferdig: ${parts.join(", ")} (${result.scanned} filer skannet).`);
    } else if (result.rejected.length) {
      scanError.value = `${result.rejected.length} fil(er) kunne ikke importeres.`;
    } else {
      showSuccess(`Ingen Cursor/Codex-filer funnet i mappen (${result.scanned} skannet).`);
    }
  }

  async function pickProjectFolder(): Promise<boolean> {
    const showDirectoryPicker = (window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    if (typeof showDirectoryPicker !== "function") {
      return false;
    }
    try {
      const handle = await showDirectoryPicker.call(window);
      projectDirectoryHandle.value = handle;
      pickedFolderFiles.value = [];
      syncFolderLabel.value = handle.name;
      scanError.value = "";
      syncError.value = "";
      return true;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return false;
      }
      scanError.value = errorMessage(caught, "Kunne ikke velge mappe.");
      return false;
    }
  }

  function setProjectFolderFromFileList(fileList: FileList) {
    projectDirectoryHandle.value = null;
    pickedFolderFiles.value = [...fileList];
    const entries = filesFromDirectoryInput(fileList);
    syncFolderLabel.value = fileList[0]?.webkitRelativePath
      ? fileList[0].webkitRelativePath.replace(/\\/g, "/").split("/")[0] ?? ""
      : "Valgt mappe";
    scanError.value = "";
    syncError.value = "";
    if (!entries.length) {
      scanError.value = "Ingen Cursor/Codex-filer funnet i valgt mappe.";
    }
  }

  async function scanFromFileList(fileList: FileList) {
    const entries = filesFromDirectoryInput(fileList);
    const files = await readDiscoveredFiles(entries);
    return importDiscoveredFiles(files);
  }

  async function importFromPickedFiles(fileList: FileList) {
    scanError.value = "";
    scanResult.value = null;
    isScanning.value = true;
    clearSuccess();
    try {
      const result = await scanFromFileList(fileList);
      await loadResources();
      applyScanFeedback(result);
    } catch (caught) {
      scanError.value = errorMessage(caught, "Kunne ikke importere fra valgt mappe.");
    } finally {
      isScanning.value = false;
    }
  }

  async function exportResources() {
    exportError.value = "";
    exportBundle.value = null;
    isExporting.value = true;
    clearSuccess();
    try {
      exportBundle.value = await api.exportAiResources(exportTarget.value);
      const count = exportBundle.value.files.length;
      showSuccess(count ? `Eksport klar: ${count} fil${count === 1 ? "" : "er"}.` : "Eksport klar (ingen filer).");
    } catch (caught) {
      exportError.value = errorMessage(caught, "Kunne ikke eksportere ressurser.");
    } finally {
      isExporting.value = false;
    }
  }

  async function runScan() {
    scanError.value = "";
    scanResult.value = null;
    isScanning.value = true;
    clearSuccess();
    try {
      if (projectDirectoryHandle.value) {
        const files = await collectFilesFromDirectoryHandle(projectDirectoryHandle.value);
        const result = await importDiscoveredFiles(files);
        await loadResources();
        applyScanFeedback(result);
        return;
      }

      if (pickedFolderFiles.value.length) {
        const result = await scanFromFileList(pickedFolderFiles.value as unknown as FileList);
        await loadResources();
        applyScanFeedback(result);
        return;
      }

      const cwd = syncCwd.value.trim();
      if (!cwd) {
        scanError.value = "Velg mappe eller skriv inn full sti.";
        return;
      }

      const result = await api.scanAiResources({ cwd });
      scanResult.value = result;
      await loadResources();
      applyScanFeedback(result);
    } catch (caught) {
      scanError.value = errorMessage(caught, "Kunne ikke skanne prosjektmappen.");
    } finally {
      isScanning.value = false;
    }
  }

  function applySyncFeedback(result: AiResourceSyncResult) {
    syncResult.value = result;
    const applied = result.files.filter((file) => file.action === "create" || file.action === "update").length;
    const noop = result.files.filter((file) => file.action === "noop").length;
    if (result.conflicts.length || result.rejected.length) {
      syncError.value = [
        result.conflicts.length ? `${result.conflicts.length} konflikt(er)` : "",
        result.rejected.length ? `${result.rejected.length} avvist` : ""
      ].filter(Boolean).join(" · ");
    }
    if (applied || noop) {
      const parts = [
        applied ? `${applied} skrevet` : "",
        noop ? `${noop} uendret` : ""
      ].filter(Boolean);
      showSuccess(`Sync ferdig: ${parts.join(", ")}.`);
    } else if (!result.conflicts.length && !result.rejected.length) {
      showSuccess("Sync ferdig (ingen filer i eksporten).");
    }
  }

  async function runSync() {
    syncError.value = "";
    syncResult.value = null;
    isSyncing.value = true;
    clearSuccess();
    try {
      if (projectDirectoryHandle.value) {
        const bundle = await api.exportAiResources(exportTarget.value);
        const result = await writeBundleToDirectory(
          projectDirectoryHandle.value,
          bundle,
          { force: syncForce.value }
        );
        applySyncFeedback(result);
        return;
      }

      const cwd = syncCwd.value.trim();
      if (!cwd) {
        syncError.value = "Velg mappe (Chrome/Edge) eller skriv inn full sti for server-sync.";
        return;
      }

      const result = await api.syncAiResources({
        target: exportTarget.value,
        cwd,
        force: syncForce.value
      });
      applySyncFeedback(result);
    } catch (caught) {
      syncError.value = errorMessage(caught, "Kunne ikke synkronisere.");
    } finally {
      isSyncing.value = false;
    }
  }

  async function testSyncConnection() {
    syncConnectionStatus.value = "checking";
    syncConnectionMessage.value = "";
    const base = syncApiUrl.value.trim() || "http://127.0.0.1:3000";
    try {
      const url = new URL("/api/health", base);
      const response = await fetch(url, {
        credentials: "include",
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        throw new Error(`Server svarte med ${response.status}.`);
      }
      const body = await response.json() as { ok?: boolean };
      if (body.ok !== true) {
        throw new Error("Uventet svar fra serveren.");
      }
      syncConnectionStatus.value = "ok";
      syncConnectionMessage.value = "API-et svarer. Du kan kjøre sync-kommandoen i terminalen.";
    } catch (caught) {
      syncConnectionStatus.value = "error";
      syncConnectionMessage.value = errorMessage(
        caught,
        "Kunne ikke nå API-et. Sjekk at backend kjører på angitt URL."
      );
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
    syncFolderLabel,
    projectDirectoryHandle,
    pickedFolderFiles,
    hasProjectFolder,
    syncCommand,
    syncDryRunCommand,
    filterTarget,
    filterKind,
    filterStatus,
    search,
    isSaving,
    deletingId,
    isImporting,
    isExporting,
    saveError,
    editError,
    deleteError,
    successMessage,
    syncConnectionStatus,
    syncConnectionMessage,
    syncForce,
    isSyncing,
    syncError,
    syncResult,
    isScanning,
    scanError,
    scanResult,
    loadResources,
    addResource,
    startEdit,
    cancelEdit,
    saveEdit,
    removeResource,
    importFromText,
    importFiles,
    pickProjectFolder,
    setProjectFolderFromFileList,
    importFromPickedFiles,
    exportResources,
    runScan,
    runSync,
    testSyncConnection,
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
