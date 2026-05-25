import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { BachelorFile, BachelorFolderTreeNode } from "@careercenter/shared";
import { api } from "../api/index.js";
import {
  fileTypeIcon,
  formatFileSize,
  useEducationBachelorStore
} from "./educationBachelor.js";

vi.mock("../api/index.js", () => ({
  api: {
    bachelorKnowledge: vi.fn(),
    bachelorFolderTree: vi.fn(),
    bachelorFiles: vi.fn(),
    createBachelorKnowledge: vi.fn(),
    deleteBachelorKnowledge: vi.fn(),
    createBachelorFolder: vi.fn(),
    updateBachelorFolder: vi.fn(),
    deleteBachelorFolder: vi.fn(),
    uploadBachelorFile: vi.fn(),
    deleteBachelorFile: vi.fn(),
    updateBachelorFile: vi.fn(),
    bachelorFileDownloadUrl: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const folderTree: BachelorFolderTreeNode[] = [
  {
    id: "folder-1",
    name: "Algoritmer",
    parentId: null,
    sortOrder: 0,
    children: [{ id: "folder-2", name: "Sortering", parentId: "folder-1", sortOrder: 0, children: [] }]
  }
];

const sampleFile: BachelorFile = {
  id: "file-1",
  folderId: null,
  originalName: "notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  notes: "",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

describe("education bachelor helpers", () => {
  it("maps mime types and extensions to icons", () => {
    expect(fileTypeIcon("image/png", "photo.png")).toBe("IMG");
    expect(fileTypeIcon("application/pdf", "doc.pdf")).toBe("PDF");
    expect(fileTypeIcon("text/plain", "readme.txt")).toBe("TXT");
    expect(fileTypeIcon("application/octet-stream", "main.ts")).toBe("CODE");
    expect(fileTypeIcon("application/octet-stream", "archive.bin")).toBe("FIL");
  });

  it("formats byte sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("useEducationBachelorStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.bachelorKnowledge.mockResolvedValue([]);
    mockedApi.bachelorFolderTree.mockResolvedValue(folderTree);
    mockedApi.bachelorFiles.mockResolvedValue([]);
    mockedApi.bachelorFileDownloadUrl.mockReturnValue("/api/education/bachelor/files/file-1/download");
  });

  it("loadAll populates entries, folders, and files", async () => {
    const store = useEducationBachelorStore();
    await store.loadAll();
    expect(store.entries).toEqual([]);
    expect(store.folderTree).toEqual(folderTree);
    expect(store.files).toEqual([]);
  });

  it("navigates folders and builds breadcrumbs", async () => {
    const store = useEducationBachelorStore();
    await store.loadAll();
    await store.navigateToFolder("folder-2");
    expect(mockedApi.bachelorFiles).toHaveBeenLastCalledWith("folder-2");
    expect(store.breadcrumbs.map((crumb) => crumb.name)).toEqual(["Rot", "Algoritmer", "Sortering"]);
    expect(store.childFolders).toHaveLength(0);
  });

  it("creates and removes knowledge entries", async () => {
    mockedApi.createBachelorKnowledge.mockResolvedValue({
      id: "k1",
      courseName: "Algoritmer",
      topic: "Heap",
      notes: "",
      sortOrder: 0
    });
    const store = useEducationBachelorStore();
    store.newEntry.courseName = "Algoritmer";
    store.newEntry.topic = "Heap";
    await store.addEntry();
    expect(store.entries).toHaveLength(1);
    await store.removeEntry("k1");
    expect(mockedApi.deleteBachelorKnowledge).toHaveBeenCalledWith("k1");
  });

  it("creates, renames, and deletes folders", async () => {
    mockedApi.createBachelorFolder.mockResolvedValue(undefined);
    mockedApi.updateBachelorFolder.mockResolvedValue(undefined);
    mockedApi.deleteBachelorFolder.mockResolvedValue(undefined);
    const store = useEducationBachelorStore();
    await store.loadAll();

    store.newFolderName = "   ";
    await store.createFolder();
    expect(mockedApi.createBachelorFolder).not.toHaveBeenCalled();

    store.newFolderName = "Ny mappe";
    await store.createFolder();
    expect(mockedApi.createBachelorFolder).toHaveBeenCalled();

    await store.renameFolder("folder-1", "Algoritmer II");
    await store.deleteFolder("folder-1");
    expect(mockedApi.deleteBachelorFolder).toHaveBeenCalledWith("folder-1");
  });

  it("toggles folder expansion and manages files", async () => {
    mockedApi.uploadBachelorFile.mockResolvedValue(sampleFile);
    mockedApi.updateBachelorFile.mockResolvedValue({ ...sampleFile, notes: "Viktig" });
    const store = useEducationBachelorStore();
    await store.loadAll();

    store.toggleFolderExpanded("folder-1");
    expect(store.expandedFolderIds.has("folder-1")).toBe(true);
    store.toggleFolderExpanded("folder-1");
    expect(store.expandedFolderIds.has("folder-1")).toBe(false);

    const file = new File(["hello"], "notes.pdf", { type: "application/pdf" });
    await store.uploadFiles([file]);
    expect(store.files).toHaveLength(1);

    await store.updateFileNotes("file-1", "Viktig");
    await store.renameFile("file-1", "notes-v2.pdf");
    await store.moveFile("file-1", "folder-1");
    await store.deleteFile("file-1");
    expect(mockedApi.deleteBachelorFile).toHaveBeenCalledWith("file-1");
    expect(store.downloadUrl("file-1")).toContain("file-1");
  });
});
