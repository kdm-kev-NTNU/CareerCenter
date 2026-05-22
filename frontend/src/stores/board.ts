import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import type {
  BoardGraph,
  BoardNodeData,
  BoardViewport,
  CareerBoard,
  CareerBoardSummary,
  CareerTrack,
  Company
} from "@careercenter/shared";
import type { Connection, Edge, Node } from "@vue-flow/core";
import { api } from "../api/index.js";
import { defaultBoardEdgeOptions, flowToGraph, graphToFlow, newNodeId } from "../utils/boardFlow.js";
import { useAppStore } from "./app.js";

export const useBoardStore = defineStore("board", () => {
  const summaries = ref<CareerBoardSummary[]>([]);
  const activeBoard = ref<CareerBoard | null>(null);
  const nodes = shallowRef<Node[]>([]);
  const edges = shallowRef<Edge[]>([]);
  const selectedEdgeId = ref<string | null>(null);
  const edgeLabelDraft = ref("");
  const editingNodeId = ref<string | null>(null);
  const edgeLabelEditRequestId = ref<string | null>(null);
  const saveState = ref<"idle" | "saving" | "saved">("idle");
  const loading = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let viewportTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSave() {
    if (!activeBoard.value) return;
    saveState.value = "saving";
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void persistBoard();
    }, 500);
  }

  async function loadBoards() {
    loading.value = true;
    try {
      summaries.value = await api.boards();
      if (!activeBoard.value && summaries.value.length > 0) {
        const preferred = summaries.value.find((board) => board.isDefault) ?? summaries.value[0];
        await selectBoard(preferred.id);
      }
    } finally {
      loading.value = false;
    }
  }

  async function selectBoard(id: string) {
    loading.value = true;
    try {
      const board = await api.board(id);
      activeBoard.value = board;
      const flow = graphToFlow(board.graph);
      nodes.value = flow.nodes;
      edges.value = flow.edges;
      selectedEdgeId.value = null;
      edgeLabelDraft.value = "";
      editingNodeId.value = null;
      edgeLabelEditRequestId.value = null;
      saveState.value = "saved";
    } finally {
      loading.value = false;
    }
  }

  async function persistBoard(viewport?: BoardViewport | null) {
    if (!activeBoard.value) return;
    saveState.value = "saving";
    try {
      const nodeList = nodes.value as Node[];
      const edgeList = edges.value as Edge[];
      const payload = {
        graph: flowToGraph(nodeList, edgeList),
        viewport: viewport === undefined ? activeBoard.value.viewport : viewport
      };
      const updated = await api.updateBoard(activeBoard.value.id, payload);
      activeBoard.value = updated;
      summaries.value = summaries.value.map((summary) =>
        summary.id === updated.id
          ? { ...summary, name: updated.name, description: updated.description, updatedAt: updated.updatedAt }
          : summary
      );
      saveState.value = "saved";
    } catch (caught) {
      saveState.value = "idle";
      const appStore = useAppStore();
      appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke lagre brett.");
    }
  }

  async function saveNow(name?: string) {
    if (!activeBoard.value) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (viewportTimer) {
      clearTimeout(viewportTimer);
      viewportTimer = null;
    }
    saveState.value = "saving";
    try {
      const nodeList = nodes.value as Node[];
      const edgeList = edges.value as Edge[];
      const trimmedName = name?.trim();
      const payload: { graph: BoardGraph; viewport: BoardViewport | null | undefined; name?: string } = {
        graph: flowToGraph(nodeList, edgeList),
        viewport: activeBoard.value.viewport
      };
      if (trimmedName && trimmedName !== activeBoard.value.name) {
        payload.name = trimmedName;
      }
      const updated = await api.updateBoard(activeBoard.value.id, payload);
      activeBoard.value = updated;
      summaries.value = summaries.value.map((summary) =>
        summary.id === updated.id
          ? { ...summary, name: updated.name, description: updated.description, updatedAt: updated.updatedAt }
          : summary
      );
      saveState.value = "saved";
    } catch (caught) {
      saveState.value = "idle";
      const appStore = useAppStore();
      appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke lagre brett.");
    }
  }

  async function createBoard(name: string) {
    const created = await api.createBoard({ name, description: "" });
    summaries.value.unshift({
      id: created.id,
      name: created.name,
      description: created.description,
      isDefault: created.isDefault,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
    await selectBoard(created.id);
  }

  async function duplicateActiveBoard() {
    if (!activeBoard.value) return;
    const duplicated = await api.duplicateBoard(activeBoard.value.id);
    summaries.value.unshift({
      id: duplicated.id,
      name: duplicated.name,
      description: duplicated.description,
      isDefault: duplicated.isDefault,
      createdAt: duplicated.createdAt,
      updatedAt: duplicated.updatedAt
    });
    await selectBoard(duplicated.id);
  }

  async function deleteActiveBoard() {
    if (!activeBoard.value) return;
    const id = activeBoard.value.id;
    await api.deleteBoard(id);
    summaries.value = summaries.value.filter((board) => board.id !== id);
    activeBoard.value = null;
    nodes.value = [];
    edges.value = [];
    if (summaries.value.length > 0) {
      await selectBoard(summaries.value[0].id);
    }
  }

  function scheduleViewportSave(viewport: BoardViewport) {
    if (!activeBoard.value) return;
    if (viewportTimer) clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      void persistBoard(viewport);
    }, 600);
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    const id = newNodeId("edge");
    edges.value = [
      ...edges.value,
      {
        id,
        source: connection.source,
        target: connection.target,
        type: defaultBoardEdgeOptions.type,
        markerEnd: defaultBoardEdgeOptions.markerEnd,
        data: { label: "" }
      }
    ];
    scheduleSave();
  }

  function onNodesChange() {
    scheduleSave();
  }

  function onEdgesChange() {
    scheduleSave();
  }

  function addCompanyNode(company: Company, position?: { x: number; y: number }) {
    const id = newNodeId("company");
    nodes.value = [
      ...nodes.value,
      {
        id,
        type: "company",
        position: position ?? { x: 120 + nodes.value.length * 24, y: 120 + nodes.value.length * 24 },
        data: { companyId: company.id, note: "" }
      }
    ];
    scheduleSave();
  }

  function addMilestoneNode(label = "Ny milepæl", position?: { x: number; y: number }) {
    const id = newNodeId("milestone");
    nodes.value = [
      ...nodes.value,
      {
        id,
        type: "milestone",
        position: position ?? { x: 200 + nodes.value.length * 20, y: 200 },
        data: { label }
      }
    ];
    scheduleSave();
  }

  function addNoteNode(text = "", position?: { x: number; y: number }): string {
    const id = newNodeId("note");
    nodes.value = [
      ...nodes.value,
      {
        id,
        type: "note",
        position: position ?? { x: 240 + nodes.value.length * 20, y: 280 },
        data: { text: text || "Notat" }
      }
    ];
    scheduleSave();
    return id;
  }

  async function renameActiveBoard(name: string) {
    if (!activeBoard.value) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === activeBoard.value.name) return;
    saveState.value = "saving";
    try {
      const updated = await api.updateBoard(activeBoard.value.id, { name: trimmed });
      activeBoard.value = { ...activeBoard.value, name: updated.name, updatedAt: updated.updatedAt };
      summaries.value = summaries.value.map((summary) =>
        summary.id === updated.id
          ? { ...summary, name: updated.name, updatedAt: updated.updatedAt }
          : summary
      );
      saveState.value = "saved";
    } catch (caught) {
      saveState.value = "idle";
      const appStore = useAppStore();
      appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke lagre brettnavn.");
    }
  }

  function updateNodeData(nodeId: string, patch: Record<string, unknown>) {
    nodes.value = nodes.value.map((node) =>
      node.id === nodeId ? { ...node, data: { ...(node.data as object), ...patch } } : node
    );
    scheduleSave();
  }

  function duplicateNode(nodeId: string) {
    const source = nodes.value.find((node) => node.id === nodeId);
    if (!source) return;
    const id = newNodeId(String(source.type ?? "node"));
    const { selected: _selected, ...rest } = source as Node & { selected?: boolean };
    nodes.value = [
      ...nodes.value,
      {
        ...rest,
        id,
        position: {
          x: Number(source.position.x) + 40,
          y: Number(source.position.y) + 40
        },
        data: { ...(source.data as object) }
      }
    ];
    scheduleSave();
  }

  function deleteNode(nodeId: string) {
    nodes.value = nodes.value.filter((node) => node.id !== nodeId);
    edges.value = edges.value.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    if (editingNodeId.value === nodeId) editingNodeId.value = null;
    scheduleSave();
  }

  function deleteEdge(edgeId: string) {
    edges.value = edges.value.filter((edge) => edge.id !== edgeId);
    if (selectedEdgeId.value === edgeId) {
      selectedEdgeId.value = null;
      edgeLabelDraft.value = "";
    }
    if (edgeLabelEditRequestId.value === edgeId) edgeLabelEditRequestId.value = null;
    scheduleSave();
  }

  function startNodeEdit(nodeId: string) {
    editingNodeId.value = nodeId;
  }

  function clearNodeEdit() {
    editingNodeId.value = null;
  }

  function requestEdgeLabelEdit(edgeId: string) {
    selectedEdgeId.value = edgeId;
    edgeLabelEditRequestId.value = edgeId;
    const edge = edges.value.find((entry) => entry.id === edgeId);
    edgeLabelDraft.value = typeof edge?.label === "string" ? edge.label : (edge?.data as { label?: string } | undefined)?.label ?? "";
  }

  function clearEdgeLabelEditRequest() {
    edgeLabelEditRequestId.value = null;
  }

  function nodeTrack(node: Node): CareerTrack | undefined {
    return (node.data as BoardNodeData & { track?: CareerTrack }).track;
  }

  function nodesForTrack(trackId: CareerTrack) {
    return nodes.value.filter((node) => nodeTrack(node) === trackId);
  }

  function selectNodesByTrack(trackId: CareerTrack) {
    nodes.value = nodes.value.map((node) => ({
      ...node,
      selected: nodeTrack(node) === trackId
    }));
    edges.value = edges.value.map((edge) => ({ ...edge, selected: false }));
  }

  function deleteNodesByTrack(trackId: CareerTrack, options?: { skipConfirm?: boolean }) {
    const matching = nodesForTrack(trackId);
    if (matching.length === 0) return;
    if (
      !options?.skipConfirm &&
      !confirm(`Slette ${matching.length} element${matching.length === 1 ? "" : "er"} for dette sporet fra brettet?`)
    ) {
      return;
    }
    const nodeIds = new Set(matching.map((node) => node.id));
    nodes.value = nodes.value.filter((node) => !nodeIds.has(node.id));
    edges.value = edges.value.filter(
      (edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
    );
    if (editingNodeId.value && nodeIds.has(editingNodeId.value)) editingNodeId.value = null;
    scheduleSave();
  }

  function removeSelectedElements(selectedNodes: Node[], selectedEdges: Edge[]) {
    const nodeIds = new Set(selectedNodes.map((node) => node.id));
    const edgeIds = new Set(selectedEdges.map((edge) => edge.id));
    nodes.value = nodes.value.filter((node) => !nodeIds.has(node.id));
    edges.value = edges.value.filter((edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target));
    if (selectedEdgeId.value && edgeIds.has(selectedEdgeId.value)) {
      selectedEdgeId.value = null;
      edgeLabelDraft.value = "";
    }
    scheduleSave();
  }

  function selectEdge(edgeId: string) {
    selectedEdgeId.value = edgeId;
    const edge = edges.value.find((entry) => entry.id === edgeId);
    edgeLabelDraft.value = typeof edge?.label === "string" ? edge.label : (edge?.data as { label?: string } | undefined)?.label ?? "";
  }

  function applyEdgeLabel(label?: string) {
    const edgeId = selectedEdgeId.value;
    if (!edgeId) return;
    const nextLabel = label ?? edgeLabelDraft.value;
    edges.value = edges.value.map((edge) =>
      edge.id === edgeId
        ? { ...edge, label: nextLabel, data: { ...(edge.data as object), label: nextLabel } }
        : edge
    );
    edgeLabelDraft.value = nextLabel;
    scheduleSave();
  }

  return {
    summaries,
    activeBoard,
    nodes,
    edges,
    selectedEdgeId,
    edgeLabelDraft,
    editingNodeId,
    edgeLabelEditRequestId,
    saveState,
    loading,
    loadBoards,
    selectBoard,
    persistBoard,
    saveNow,
    createBoard,
    duplicateActiveBoard,
    deleteActiveBoard,
    onConnect,
    onNodesChange,
    onEdgesChange,
    addCompanyNode,
    addMilestoneNode,
    addNoteNode,
    renameActiveBoard,
    updateNodeData,
    duplicateNode,
    deleteNode,
    deleteEdge,
    startNodeEdit,
    clearNodeEdit,
    requestEdgeLabelEdit,
    clearEdgeLabelEditRequest,
    scheduleViewportSave,
    removeSelectedElements,
    selectNodesByTrack,
    deleteNodesByTrack,
    nodesForTrack,
    selectEdge,
    applyEdgeLabel,
    scheduleSave
  };
});
