import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { BachelorFile, BachelorFolderTreeNode, BachelorKnowledge } from "@careercenter/shared";
import { api } from "../api/index.js";
import { MAX_BACHELOR_FILE_BYTES } from "../api/client.js";
import type { BachelorKnowledgePayload } from "../types/index.js";

export type BachelorUploadResult = {
  fileName: string;
  ok: boolean;
  message?: string;
};

function entryToPayload(entry: BachelorKnowledge): BachelorKnowledgePayload {
  return {
    folderId: entry.folderId,
    courseName: entry.courseName,
    topic: entry.topic,
    notes: entry.notes,
    sortOrder: entry.sortOrder
  };
}

function findFolderPath(
  nodes: BachelorFolderTreeNode[],
  targetId: string | null,
  trail: BachelorFolderTreeNode[] = []
): BachelorFolderTreeNode[] | null {
  if (targetId === null) return [];
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === targetId) return next;
    const found = findFolderPath(node.children, targetId, next);
    if (found) return found;
  }
  return null;
}

export function fileTypeIcon(mimeType: string, fileName: string): string {
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) return "PDF";
  if (mimeType.includes("word") || fileName.match(/\.docx?$/i)) return "DOC";
  if (mimeType.includes("sheet") || fileName.match(/\.xlsx?$/i)) return "XLS";
  if (mimeType.includes("presentation") || fileName.match(/\.pptx?$/i)) return "PPT";
  if (mimeType.startsWith("text/") || fileName.match(/\.(md|txt|csv)$/i)) return "TXT";
  if (fileName.match(/\.(js|ts|py|java|cpp|c|go|rs)$/i)) return "CODE";
  return "FIL";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const useEducationBachelorStore = defineStore("educationBachelor", () => {
  const entries = ref<BachelorKnowledge[]>([]);
  const entryCount = ref(0);
  const folderTree = ref<BachelorFolderTreeNode[]>([]);
  const files = ref<BachelorFile[]>([]);
  const currentFolderId = ref<string | null>(null);
  const uploading = ref(false);
  const uploadError = ref("");
  const uploadResults = ref<BachelorUploadResult[]>([]);
  const uploadProgress = ref({ current: 0, total: 0 });
  const expandedFolderIds = ref<Set<string>>(new Set());

  const newEntry = ref<BachelorKnowledgePayload>({
    courseName: "",
    topic: "",
    notes: "",
    sortOrder: 0
  });

  const newFolderName = ref("");

  const breadcrumbs = computed(() => {
    const path = findFolderPath(folderTree.value, currentFolderId.value) ?? [];
    return [{ id: null as string | null, name: "Rot" }, ...path.map((f) => ({ id: f.id, name: f.name }))];
  });

  const childFolders = computed(() => {
    const id = currentFolderId.value;
    if (id === null) return folderTree.value;
    const path = findFolderPath(folderTree.value, id);
    const current = path?.[path.length - 1];
    return current?.children ?? [];
  });

  async function loadEntryCount() {
    const all = await api.bachelorKnowledge();
    entryCount.value = all.length;
  }

  async function loadEntries() {
    entries.value = await api.bachelorKnowledge(currentFolderId.value);
  }

  async function loadFolderTree() {
    folderTree.value = await api.bachelorFolderTree();
  }

  async function loadFiles() {
    files.value = await api.bachelorFiles(currentFolderId.value);
  }

  async function loadAll() {
    await Promise.all([loadFolderTree(), loadFiles(), loadEntries(), loadEntryCount()]);
  }

  function navigateToFolder(folderId: string | null) {
    currentFolderId.value = folderId;
    void Promise.all([loadFiles(), loadEntries()]);
  }

  function toggleFolderExpanded(folderId: string) {
    const next = new Set(expandedFolderIds.value);
    if (next.has(folderId)) next.delete(folderId);
    else next.add(folderId);
    expandedFolderIds.value = next;
  }

  async function addEntry() {
    const payload: BachelorKnowledgePayload = {
      ...newEntry.value,
      folderId: currentFolderId.value,
      sortOrder: entries.value.length
    };
    const created = await api.createBachelorKnowledge(payload);
    entries.value.push(created);
    entryCount.value += 1;
    newEntry.value = {
      courseName: newEntry.value.courseName,
      topic: "",
      notes: "",
      sortOrder: 0
    };
  }

  async function removeEntry(id: string) {
    await api.deleteBachelorKnowledge(id);
    entries.value = entries.value.filter((entry) => entry.id !== id);
    entryCount.value = Math.max(0, entryCount.value - 1);
  }

  async function updateEntryNotes(id: string, notes: string) {
    const entry = entries.value.find((item) => item.id === id);
    if (!entry) return;
    const updated = await api.updateBachelorKnowledge(id, { ...entryToPayload(entry), notes });
    const index = entries.value.findIndex((item) => item.id === id);
    if (index >= 0) entries.value[index] = updated;
  }

  async function createFolder() {
    const name = newFolderName.value.trim();
    if (!name) return;
    await api.createBachelorFolder({
      name,
      parentId: currentFolderId.value,
      sortOrder: childFolders.value.length
    });
    newFolderName.value = "";
    await loadFolderTree();
  }

  async function renameFolder(folderId: string, name: string) {
    const path = findFolderPath(folderTree.value, folderId);
    const folder = path?.[path.length - 1];
    if (!folder) return;
    await api.updateBachelorFolder(folderId, {
      name,
      parentId: folder.parentId,
      sortOrder: folder.sortOrder
    });
    await loadFolderTree();
  }

  async function deleteFolder(folderId: string) {
    await api.deleteBachelorFolder(folderId);
    if (currentFolderId.value === folderId) currentFolderId.value = null;
    await loadFolderTree();
    await Promise.all([loadFiles(), loadEntries(), loadEntryCount()]);
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const items = [...fileList];
    if (!items.length) return;
    uploading.value = true;
    uploadError.value = "";
    uploadResults.value = [];
    uploadProgress.value = { current: 0, total: items.length };
    const failures: string[] = [];

    try {
      for (const file of items) {
        uploadProgress.value = {
          current: uploadProgress.value.current + 1,
          total: items.length
        };

        if (file.size === 0) {
          const message = "Filen er tom.";
          uploadResults.value.push({ fileName: file.name, ok: false, message });
          failures.push(`${file.name}: ${message}`);
          continue;
        }

        if (file.size > MAX_BACHELOR_FILE_BYTES) {
          const message = "Filen er for stor (maks 50 MB).";
          uploadResults.value.push({ fileName: file.name, ok: false, message });
          failures.push(`${file.name}: ${message}`);
          continue;
        }

        try {
          const created = await api.uploadBachelorFile(file, currentFolderId.value);
          files.value.push(created);
          uploadResults.value.push({ fileName: file.name, ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Opplasting feilet.";
          uploadResults.value.push({ fileName: file.name, ok: false, message });
          failures.push(`${file.name}: ${message}`);
        }
      }
    } finally {
      uploading.value = false;
      uploadProgress.value = { current: 0, total: 0 };
    }

    if (failures.length) {
      uploadError.value = failures.join(" ");
    }
  }

  function clearUploadFeedback() {
    uploadError.value = "";
    uploadResults.value = [];
  }

  async function deleteFile(id: string) {
    await api.deleteBachelorFile(id);
    files.value = files.value.filter((f) => f.id !== id);
  }

  async function updateFileNotes(id: string, notes: string) {
    const updated = await api.updateBachelorFile(id, { notes });
    const index = files.value.findIndex((f) => f.id === id);
    if (index >= 0) files.value[index] = updated;
  }

  async function renameFile(id: string, originalName: string) {
    const updated = await api.updateBachelorFile(id, { originalName });
    const index = files.value.findIndex((f) => f.id === id);
    if (index >= 0) files.value[index] = updated;
  }

  async function moveFile(id: string, folderId: string | null) {
    const updated = await api.updateBachelorFile(id, { folderId });
    files.value = files.value.filter((f) => f.id !== id);
    if (folderId === currentFolderId.value) files.value.push(updated);
  }

  function downloadUrl(id: string) {
    return api.bachelorFileDownloadUrl(id);
  }

  return {
    entries,
    entryCount,
    folderTree,
    files,
    currentFolderId,
    uploading,
    uploadError,
    uploadResults,
    uploadProgress,
    expandedFolderIds,
    newEntry,
    newFolderName,
    breadcrumbs,
    childFolders,
    loadEntries,
    loadEntryCount,
    loadFolderTree,
    loadFiles,
    loadAll,
    navigateToFolder,
    toggleFolderExpanded,
    addEntry,
    removeEntry,
    updateEntryNotes,
    createFolder,
    renameFolder,
    deleteFolder,
    uploadFiles,
    clearUploadFeedback,
    deleteFile,
    updateFileNotes,
    renameFile,
    moveFile,
    downloadUrl
  };
});
