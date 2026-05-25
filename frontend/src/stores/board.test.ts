import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Company } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useBoardStore } from "./board.js";

const setError = vi.fn();

vi.mock("./app.js", () => ({
  useAppStore: () => ({ setError })
}));

vi.mock("../api/index.js", () => ({
  api: {
    boards: vi.fn(),
    board: vi.fn(),
    updateBoard: vi.fn(),
    createBoard: vi.fn(),
    deleteBoard: vi.fn(),
    duplicateBoard: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const summary = {
  id: "board-1",
  name: "Main",
  description: "",
  isDefault: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

const fullBoard = {
  ...summary,
  viewport: { x: 0, y: 0, zoom: 1 },
  graph: {
    nodes: [{ id: "n1", type: "milestone" as const, position: { x: 0, y: 0 }, data: { label: "Start" } }],
    edges: [{ id: "e1", source: "n1", target: "n1", data: { label: "loop" } }]
  }
};

const company = (id: string): Company =>
  ({
    id,
    name: id,
    description: "",
    tracks: ["ENERGY_QUANT"],
    tier: 1,
    geography: "Oslo",
    roleTypes: [],
    difficulty: "Medium",
    upside: "High",
    relevanceScore: 0
  }) as Company;

describe("useBoardStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.boards.mockResolvedValue([summary]);
    mockedApi.board.mockResolvedValue(fullBoard);
    mockedApi.updateBoard.mockResolvedValue(fullBoard);
    mockedApi.createBoard.mockResolvedValue({ ...fullBoard, id: "board-2", name: "New board" });
    mockedApi.duplicateBoard.mockResolvedValue({ ...fullBoard, id: "board-3", name: "Main kopi" });
    mockedApi.deleteBoard.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads boards and selects the default board", async () => {
    const store = useBoardStore();
    await store.loadBoards();
    expect(store.summaries).toHaveLength(1);
    expect(store.activeBoard?.id).toBe("board-1");
    expect(store.nodes).toHaveLength(1);
    expect(store.edges).toHaveLength(1);
  });

  it("renames the active board", async () => {
    mockedApi.updateBoard.mockResolvedValue({ ...fullBoard, name: "Plan B" });
    const store = useBoardStore();
    await store.loadBoards();
    await store.renameActiveBoard("Plan B");
    expect(mockedApi.updateBoard).toHaveBeenCalledWith("board-1", { name: "Plan B" });
    expect(store.activeBoard?.name).toBe("Plan B");
  });

  it("creates, duplicates, and deletes boards", async () => {
    const store = useBoardStore();
    await store.loadBoards();

    mockedApi.board.mockImplementation(async (id: string) => ({
      ...fullBoard,
      id,
      name: id === "board-2" ? "New board" : id === "board-3" ? "Main kopi" : fullBoard.name
    }));
    await store.createBoard("New board");
    expect(store.summaries[0].id).toBe("board-2");
    expect(store.activeBoard?.id).toBe("board-2");

    await store.duplicateActiveBoard();
    expect(store.activeBoard?.id).toBe("board-3");

    await store.deleteActiveBoard();
    expect(mockedApi.deleteBoard).toHaveBeenCalledWith("board-3");
  });

  it("mutates graph elements and schedules persistence", async () => {
    const store = useBoardStore();
    await store.loadBoards();

    store.onConnect({ source: "n1", target: "n1" });
    expect(store.edges.length).toBeGreaterThan(1);

    store.addCompanyNode(company("statkraft"));
    store.addMilestoneNode("Ny milepæl");
    const noteId = store.addNoteNode("Mitt notat");
    expect(store.nodes.some((node) => node.id === noteId)).toBe(true);

    store.updateNodeData("n1", { label: "Oppdatert" });
    store.duplicateNode("n1");
    store.deleteEdge("e1");
    store.selectEdge(store.edges[0]?.id ?? "");
    store.applyEdgeLabel("Kobling");
    store.removeSelectedElements([store.nodes[0]], []);

    vi.advanceTimersByTime(600);
    await vi.runAllTimersAsync();
    expect(mockedApi.updateBoard).toHaveBeenCalled();
  });

  it("handles node and edge editing helpers", async () => {
    const store = useBoardStore();
    await store.loadBoards();

    store.startNodeEdit("n1");
    expect(store.editingNodeId).toBe("n1");
    store.clearNodeEdit();
    expect(store.editingNodeId).toBeNull();

    store.requestEdgeLabelEdit("e1");
    expect(store.selectedEdgeId).toBe("e1");
    store.clearEdgeLabelEditRequest();
    expect(store.edgeLabelEditRequestId).toBeNull();

    store.deleteNode("n1");
    expect(store.nodes).toHaveLength(0);
  });

  it("reports save failures through the app store", async () => {
    mockedApi.updateBoard.mockRejectedValue(new Error("Nettverksfeil"));
    const store = useBoardStore();
    await store.loadBoards();
    await store.saveNow();
    expect(setError).toHaveBeenCalledWith("Nettverksfeil");
    expect(store.saveState).toBe("idle");
  });
});
