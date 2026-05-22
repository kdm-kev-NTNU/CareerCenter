<script setup lang="ts">
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import {
  SelectionMode,
  VueFlow,
  useVueFlow,
  type EdgeMouseEvent,
  type NodeMouseEvent
} from "@vue-flow/core";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useBoardStore } from "../../stores/board.js";
import { useCompaniesStore } from "../../stores/companies.js";
import { defaultBoardEdgeOptions } from "../../utils/boardFlow.js";
import { readBoardDragData } from "../../utils/boardDrag.js";
import BoardContextMenu, { type BoardContextMenuTarget } from "./BoardContextMenu.vue";
import BoardPaneMenu from "./BoardPaneMenu.vue";
import CompanyBoardNode from "./CompanyBoardNode.vue";
import CustomEdge from "./CustomEdge.vue";
import MilestoneBoardNode from "./MilestoneBoardNode.vue";
import NoteBoardNode from "./NoteBoardNode.vue";

import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

const boardStore = useBoardStore();
const companiesStore = useCompaniesStore();
const flowId = "career-board";
const { fitView, getSelectedNodes, getSelectedEdges, screenToFlowCoordinate, setViewport, getViewport } =
  useVueFlow(flowId);

const canvasWrapRef = ref<HTMLElement | null>(null);
const contextMenu = ref<{ target: BoardContextMenuTarget; x: number; y: number } | null>(null);
const paneMenu = ref<{ x: number; y: number; flowPosition: { x: number; y: number } } | null>(null);

const edgeTypes = { board: CustomEdge };

const defaultViewport = computed(
  () => boardStore.activeBoard?.viewport ?? { zoom: 0.75, x: 0, y: 0 }
);

const shouldFitOnLoad = computed(() => !boardStore.activeBoard?.viewport);

const selectionCount = computed(
  () => getSelectedNodes.value.length + getSelectedEdges.value.length
);

function closeContextMenu() {
  contextMenu.value = null;
}

function closePaneMenu() {
  paneMenu.value = null;
}

function closeMenus() {
  closeContextMenu();
  closePaneMenu();
}

function pointerClient(event: MouseEvent | TouchEvent) {
  if ("clientX" in event) return { x: event.clientX, y: event.clientY };
  const touch = event.changedTouches[0];
  return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
}

function openContextMenu(target: BoardContextMenuTarget, event: MouseEvent | TouchEvent) {
  event.preventDefault();
  const { x, y } = pointerClient(event);
  const rect = canvasWrapRef.value?.getBoundingClientRect();
  contextMenu.value = {
    target,
    x: rect ? x - rect.left : x,
    y: rect ? y - rect.top : y
  };
}

function handleNodeContextMenu(payload: NodeMouseEvent) {
  openContextMenu({ kind: "node", id: payload.node.id, type: payload.node.type }, payload.event);
}

function handleEdgeContextMenu(payload: EdgeMouseEvent) {
  openContextMenu({ kind: "edge", id: payload.edge.id }, payload.event);
}

function handlePaneClick(event: MouseEvent) {
  event.stopPropagation();
  boardStore.selectedEdgeId = null;
  boardStore.edgeLabelDraft = "";
  closeContextMenu();
  const rect = canvasWrapRef.value?.getBoundingClientRect();
  const flowPosition = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  paneMenu.value = {
    x: rect ? event.clientX - rect.left : event.clientX,
    y: rect ? event.clientY - rect.top : event.clientY,
    flowPosition
  };
}

function handlePaneContextMenu(event: MouseEvent) {
  event.preventDefault();
  boardStore.selectedEdgeId = null;
  boardStore.edgeLabelDraft = "";
  closeContextMenu();
  const rect = canvasWrapRef.value?.getBoundingClientRect();
  const flowPosition = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  paneMenu.value = {
    x: rect ? event.clientX - rect.left : event.clientX,
    y: rect ? event.clientY - rect.top : event.clientY,
    flowPosition
  };
}

function handlePaneAddNote() {
  const position = paneMenu.value?.flowPosition;
  if (!position) return;
  const nodeId = boardStore.addNoteNode("", position);
  boardStore.startNodeEdit(nodeId);
  closePaneMenu();
}

function handleContextEdit() {
  const target = contextMenu.value?.target;
  if (!target) return;
  if (target.kind === "node") {
    boardStore.startNodeEdit(target.id);
  } else {
    boardStore.requestEdgeLabelEdit(target.id);
  }
  closeContextMenu();
}

function handleContextDuplicate() {
  const target = contextMenu.value?.target;
  if (target?.kind === "node") boardStore.duplicateNode(target.id);
  closeContextMenu();
}

function handleContextDelete() {
  const target = contextMenu.value?.target;
  if (!target) return;
  if (target.kind === "node") boardStore.deleteNode(target.id);
  else boardStore.deleteEdge(target.id);
  closeContextMenu();
}

function handleViewportChange() {
  if (!boardStore.activeBoard) return;
  boardStore.scheduleViewportSave(getViewport());
}

function handleDragOver(event: DragEvent) {
  if (!readBoardDragData(event.dataTransfer!)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}

function handleDrop(event: DragEvent) {
  const payload = readBoardDragData(event.dataTransfer!);
  if (!payload) return;
  event.preventDefault();
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  if (payload.kind === "company") {
    const company = companiesStore.companies.find((entry) => entry.id === payload.companyId);
    if (company) boardStore.addCompanyNode(company, position);
  } else if (payload.kind === "milestone") {
    boardStore.addMilestoneNode(payload.label, position);
  } else if (payload.kind === "note") {
    boardStore.addNoteNode(payload.text, position);
  }
}

function deleteSelectedElements() {
  const selectedNodes = getSelectedNodes.value;
  const selectedEdges = getSelectedEdges.value;
  if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
  const total = selectedNodes.length + selectedEdges.length;
  if (total > 1 && !confirm(`Slette ${total} valgte elementer?`)) return;
  boardStore.removeSelectedElements(selectedNodes, selectedEdges);
  closeContextMenu();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select")) return;
  const selectedNodes = getSelectedNodes.value;
  const selectedEdges = getSelectedEdges.value;
  if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
  event.preventDefault();
  deleteSelectedElements();
}

function applyViewportFromBoard() {
  const vp = boardStore.activeBoard?.viewport;
  if (vp) {
    void setViewport(vp, { duration: 0 });
    return;
  }
  void fitView({ padding: 0.15, duration: 200 });
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  applyViewportFromBoard();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

watch(
  () => boardStore.activeBoard?.id,
  () => {
    closeMenus();
    applyViewportFromBoard();
  }
);
</script>

<template>
  <div ref="canvasWrapRef" class="board-canvas-wrap" @click="closeMenus">
    <VueFlow
      :id="flowId"
      v-model:nodes="boardStore.nodes"
      v-model:edges="boardStore.edges"
      :default-viewport="defaultViewport"
      :default-edge-options="defaultBoardEdgeOptions"
      :edge-types="edgeTypes"
      :fit-view-on-init="shouldFitOnLoad"
      :selection-on-drag="true"
      :pan-on-drag="[1, 2]"
      :selection-mode="SelectionMode.Partial"
      :multi-selection-key-code="['Shift', 'Control', 'Meta']"
      :elements-selectable="true"
      @connect="boardStore.onConnect"
      @node-drag-stop="boardStore.onNodesChange"
      @nodes-change="boardStore.onNodesChange"
      @edges-change="boardStore.onEdgesChange"
      @pane-click="handlePaneClick"
      @pane-context-menu="handlePaneContextMenu"
      @node-context-menu="handleNodeContextMenu"
      @edge-context-menu="handleEdgeContextMenu"
      @move-end="handleViewportChange"
      @viewport-change-end="handleViewportChange"
      @dragover="handleDragOver"
      @drop="handleDrop"
    >
      <Background :gap="20" />
      <Controls />

      <template #node-company="nodeProps">
        <CompanyBoardNode v-bind="nodeProps" />
      </template>
      <template #node-milestone="nodeProps">
        <MilestoneBoardNode v-bind="nodeProps" />
      </template>
      <template #node-note="nodeProps">
        <NoteBoardNode v-bind="nodeProps" />
      </template>
    </VueFlow>

    <div v-if="selectionCount > 0" class="board-selection-bar panel" @click.stop>
      <span>{{ selectionCount }} valgt</span>
      <button type="button" class="ghost" @click="deleteSelectedElements">Slett valgte</button>
      <small class="board-selection-hint">Delete</small>
    </div>

    <BoardContextMenu
      v-if="contextMenu"
      :target="contextMenu.target"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @edit="handleContextEdit"
      @duplicate="handleContextDuplicate"
      @delete="handleContextDelete"
      @close="closeContextMenu"
    />

    <BoardPaneMenu
      v-if="paneMenu"
      :x="paneMenu.x"
      :y="paneMenu.y"
      @add-note="handlePaneAddNote"
      @close="closePaneMenu"
    />
  </div>
</template>
