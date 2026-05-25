import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import CareerBoardCanvas from "./CareerBoardCanvas.vue";

const BOARD_DRAG_MIME = "application/x-career-board-node";

const vueFlowMocks = vi.hoisted(() => ({
  mockFitView: vi.fn(),
  mockGetSelectedNodes: vi.fn().mockReturnValue([]),
  mockGetSelectedEdges: vi.fn().mockReturnValue([]),
  mockScreenToFlowCoordinate: vi.fn().mockReturnValue({ x: 100, y: 100 }),
  mockSetViewport: vi.fn(),
  mockGetViewport: vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 })
}));

const {
  mockFitView,
  mockGetSelectedNodes,
  mockGetSelectedEdges,
  mockScreenToFlowCoordinate,
  mockSetViewport,
  mockGetViewport
} = vueFlowMocks;

// Mock Vue Flow
vi.mock("@vue-flow/core", () => ({
  VueFlow: {
    template: `
      <div class="vue-flow-mock">
        <slot />
        <slot name="node-company" v-bind="{ id: 'node-1', data: {} }" />
        <slot name="node-milestone" v-bind="{ id: 'node-2', data: {} }" />
        <slot name="node-note" v-bind="{ id: 'node-3', data: {} }" />
      </div>
    `,
    props: [
      "id",
      "nodes",
      "edges",
      "defaultViewport",
      "defaultEdgeOptions",
      "edgeTypes",
      "fitViewOnInit",
      "selectionOnDrag",
      "panOnDrag",
      "selectionMode",
      "multiSelectionKeyCode",
      "elementsSelectable"
    ],
    emits: [
      "connect",
      "nodeDragStop",
      "nodesChange",
      "edgesChange",
      "paneClick",
      "paneContextMenu",
      "nodeContextMenu",
      "edgeContextMenu",
      "moveEnd",
      "viewportChangeEnd",
      "dragover",
      "drop"
    ]
  },
  useVueFlow: vi.fn(() => ({
    fitView: vueFlowMocks.mockFitView,
    getSelectedNodes: vueFlowMocks.mockGetSelectedNodes,
    getSelectedEdges: vueFlowMocks.mockGetSelectedEdges,
    screenToFlowCoordinate: vueFlowMocks.mockScreenToFlowCoordinate,
    setViewport: vueFlowMocks.mockSetViewport,
    getViewport: vueFlowMocks.mockGetViewport
  })),
  SelectionMode: { Partial: "partial" }
}));

vi.mock("@vue-flow/background", () => ({
  Background: {
    template: `<div class="background-mock" />`
  }
}));

vi.mock("@vue-flow/controls", () => ({
  Controls: {
    template: `<div class="controls-mock" />`
  }
}));

// Mock child components
vi.mock("./BoardContextMenu.vue", () => ({
  default: {
    template: `<div class="board-context-menu-mock" @click="$emit('edit')" />`,
    props: ["target", "x", "y"],
    emits: ["edit", "duplicate", "delete", "close"]
  }
}));

vi.mock("./BoardPaneMenu.vue", () => ({
  default: {
    template: `<div class="board-pane-menu-mock" @click="$emit('addNote')" />`,
    props: ["x", "y"],
    emits: ["addNote", "close"]
  }
}));

vi.mock("./CompanyBoardNode.vue", () => ({
  default: {
    template: `<div class="company-node-mock" />`
  }
}));

vi.mock("./MilestoneBoardNode.vue", () => ({
  default: {
    template: `<div class="milestone-node-mock" />`
  }
}));

vi.mock("./NoteBoardNode.vue", () => ({
  default: {
    template: `<div class="note-node-mock" />`
  }
}));

vi.mock("./CustomEdge.vue", () => ({
  default: {
    template: `<div class="custom-edge-mock" />`
  }
}));

// Mock stores - use factory function to return fresh instances
let mockBoardStore: ReturnType<typeof createMockBoardStore>;

const createMockBoardStore = (overrides = {}) => ({
  summaries: [],
  activeBoard: {
    id: "board-1",
    name: "Test Board",
    viewport: { x: 0, y: 0, zoom: 0.75 }
  },
  nodes: [
    { id: "node-1", type: "company", position: { x: 100, y: 100 }, data: { companyId: "company-1" } },
    { id: "node-2", type: "milestone", position: { x: 200, y: 200 }, data: { label: "Milestone" } }
  ],
  edges: [{ id: "edge-1", source: "node-1", target: "node-2", data: { label: "" } }],
  selectedEdgeId: null as string | null,
  edgeLabelDraft: "",
  editingNodeId: null as string | null,
  edgeLabelEditRequestId: null as string | null,
  saveState: "saved" as const,
  loading: false,
  loadBoards: vi.fn(),
  onConnect: vi.fn(),
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  addCompanyNode: vi.fn(),
  addMilestoneNode: vi.fn(),
  addNoteNode: vi.fn().mockReturnValue("note-1"),
  startNodeEdit: vi.fn(),
  duplicateNode: vi.fn(),
  deleteNode: vi.fn(),
  deleteEdge: vi.fn(),
  requestEdgeLabelEdit: vi.fn(),
  removeSelectedElements: vi.fn(),
  scheduleViewportSave: vi.fn(),
  selectEdge: vi.fn(),
  applyEdgeLabel: vi.fn(),
  ...overrides
});

vi.mock("../../stores/board.js", () => ({
  useBoardStore: vi.fn(() => mockBoardStore)
}));

const mockCompanies = [
  { id: "company-1", name: "Test Company", description: "", tracks: [], tier: 1, geography: "", roleTypes: [], difficulty: "", upside: "", relevanceScore: 0 }
];

vi.mock("../../stores/companies.js", () => ({
  useCompaniesStore: vi.fn(() => ({
    companies: mockCompanies
  }))
}));

// Mock utils
vi.mock("../../utils/boardFlow.js", () => ({
  defaultBoardEdgeOptions: { type: "board", animated: false },
  flowToGraph: vi.fn(),
  graphToFlow: vi.fn()
}));

vi.mock("../../utils/boardDrag.js", () => ({
  readBoardDragData: vi.fn().mockImplementation((dataTransfer: DataTransfer) => {
    const raw = dataTransfer.getData(BOARD_DRAG_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }),
  BOARD_DRAG_MIME
}));

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: vi.fn().mockReturnValue("mock-uuid-123")
  }
});

describe("CareerBoardCanvas", () => {
  let wrapper: ReturnType<typeof mount>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.useFakeTimers();
    pinia = createPinia();
    setActivePinia(pinia);
    
    // Reset mocks
    mockFitView = vi.fn();
    mockGetSelectedNodes = vi.fn().mockReturnValue([]);
    mockGetSelectedEdges = vi.fn().mockReturnValue([]);
    mockScreenToFlowCoordinate = vi.fn().mockReturnValue({ x: 100, y: 100 });
    mockSetViewport = vi.fn();
    mockGetViewport = vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 });
    
    mockBoardStore = createMockBoardStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (wrapper) wrapper.unmount();
  });

  function mountComponent() {
    return mount(CareerBoardCanvas, {
      global: {
        plugins: [pinia]
      }
    });
  }

  describe("rendering", () => {
    it("renders the Vue Flow container", async () => {
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
      expect(wrapper.find(".background-mock").exists()).toBe(true);
      expect(wrapper.find(".controls-mock").exists()).toBe(true);
    });

    it("renders with correct Vue Flow props", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      expect(vueFlow.exists()).toBe(true);
    });

    it("renders node templates", async () => {
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".company-node-mock").exists()).toBe(true);
      expect(wrapper.find(".milestone-node-mock").exists()).toBe(true);
      expect(wrapper.find(".note-node-mock").exists()).toBe(true);
    });

    it("does not show selection bar when nothing is selected", async () => {
      mockGetSelectedNodes.mockReturnValue([]);
      mockGetSelectedEdges.mockReturnValue([]);
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(false);
    });

    it("shows selection bar when nodes are selected", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }]);
      mockGetSelectedEdges.mockReturnValue([]);
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("1 valgt");
    });

    it("shows selection bar with correct count for multiple selections", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }, { id: "node-2" }]);
      mockGetSelectedEdges.mockReturnValue([{ id: "edge-1" }]);
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("3 valgt");
    });
  });

  describe("computed properties", () => {
    it("uses default viewport from active board", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      expect(vueFlow.props("defaultViewport")).toEqual({ x: 0, y: 0, zoom: 0.75 });
    });

    it("should fit view on init when no viewport exists", async () => {
      mockBoardStore = createMockBoardStore({
        activeBoard: { id: "board-1", name: "Test Board", viewport: null }
      });
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      expect(vueFlow.props("fitViewOnInit")).toBe(true);
    });

    it("should not fit view on init when viewport exists", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      expect(vueFlow.props("fitViewOnInit")).toBe(false);
    });
  });

  describe("pane interactions", () => {
    it("opens pane menu on pane click", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });

      // Simulate pane click
      const clickEvent = new MouseEvent("click", {
        clientX: 150,
        clientY: 200,
        bubbles: true
      });
      Object.defineProperty(clickEvent, "stopPropagation", { value: vi.fn() });

      await vueFlow.vm.$emit("paneClick", clickEvent);
      await flushPromises();

      // Pane menu should be visible
      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);
    });

    it("opens pane menu on pane context menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });

      const contextMenuEvent = new MouseEvent("contextmenu", {
        clientX: 150,
        clientY: 200,
        bubbles: true
      });

      await vueFlow.vm.$emit("paneContextMenu", contextMenuEvent);
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);
    });

    it("closes menus when clicking on canvas wrapper", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // First open a pane menu
      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("paneClick", new MouseEvent("click", { clientX: 100, clientY: 100 }));
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);

      // Click on wrapper to close
      await wrapper.find(".board-canvas-wrap").trigger("click");
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(false);
    });

    it("clears edge selection on pane click", async () => {
      mockBoardStore.selectedEdgeId = "edge-1";
      mockBoardStore.edgeLabelDraft = "draft label";

      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("paneClick", new MouseEvent("click", { clientX: 100, clientY: 100 }));
      await flushPromises();

      expect(mockBoardStore.selectedEdgeId).toBeNull();
      expect(mockBoardStore.edgeLabelDraft).toBe("");
    });
  });

  describe("context menu interactions", () => {
    it("opens context menu on node context menu event", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(true);
    });

    it("opens context menu on edge context menu event", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const edgeEvent = {
        edge: { id: "edge-1", source: "node-1", target: "node-2" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("edgeContextMenu", edgeEvent);
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(true);
    });

    it("handles node edit from context menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("edit");
      await flushPromises();

      expect(mockBoardStore.startNodeEdit).toHaveBeenCalledWith("node-1");
    });

    it("handles edge edit from context menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const edgeEvent = {
        edge: { id: "edge-1", source: "node-1", target: "node-2" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("edgeContextMenu", edgeEvent);
      await flushPromises();

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("edit");
      await flushPromises();

      expect(mockBoardStore.requestEdgeLabelEdit).toHaveBeenCalledWith("edge-1");
    });

    it("handles duplicate from context menu for nodes", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("duplicate");
      await flushPromises();

      expect(mockBoardStore.duplicateNode).toHaveBeenCalledWith("node-1");
    });

    it("handles delete from context menu for nodes", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("delete");
      await flushPromises();

      expect(mockBoardStore.deleteNode).toHaveBeenCalledWith("node-1");
    });

    it("handles delete from context menu for edges", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const edgeEvent = {
        edge: { id: "edge-1", source: "node-1", target: "node-2" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("edgeContextMenu", edgeEvent);
      await flushPromises();

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("delete");
      await flushPromises();

      expect(mockBoardStore.deleteEdge).toHaveBeenCalledWith("edge-1");
    });

    it("closes context menu on close event", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(true);

      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("close");
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(false);
    });
  });

  describe("pane menu interactions", () => {
    it("handles add note from pane menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("paneClick", new MouseEvent("click", { clientX: 100, clientY: 100 }));
      await flushPromises();

      const paneMenu = wrapper.findComponent({ name: "BoardPaneMenu" });
      await paneMenu.vm.$emit("addNote");
      await flushPromises();

      expect(mockBoardStore.addNoteNode).toHaveBeenCalled();
      expect(mockBoardStore.startNodeEdit).toHaveBeenCalledWith("note-1");
    });

    it("closes pane menu on close event", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("paneClick", new MouseEvent("click", { clientX: 100, clientY: 100 }));
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);

      const paneMenu = wrapper.findComponent({ name: "BoardPaneMenu" });
      await paneMenu.vm.$emit("close");
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(false);
    });
  });

  describe("drag and drop", () => {
    it("handles drag over with valid board drag data", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify({ kind: "company", companyId: "company-1" }));

      const dragEvent = new DragEvent("dragover", { dataTransfer });
      await vueFlow.vm.$emit("dragover", dragEvent);

      expect(dragEvent.defaultPrevented).toBe(true);
    });

    it("handles drop with company payload", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify({ kind: "company", companyId: "company-1" }));

      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        clientX: 150,
        clientY: 200
      });

      await vueFlow.vm.$emit("drop", dropEvent);
      await flushPromises();

      expect(mockScreenToFlowCoordinate).toHaveBeenCalledWith({ x: 150, y: 200 });
      expect(mockBoardStore.addCompanyNode).toHaveBeenCalled();
    });

    it("handles drop with milestone payload", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify({ kind: "milestone", label: "New Milestone" }));

      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        clientX: 150,
        clientY: 200
      });

      await vueFlow.vm.$emit("drop", dropEvent);
      await flushPromises();

      expect(mockBoardStore.addMilestoneNode).toHaveBeenCalledWith("New Milestone", expect.any(Object));
    });

    it("handles drop with note payload", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();
      dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify({ kind: "note", text: "My Note" }));

      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        clientX: 150,
        clientY: 200
      });

      await vueFlow.vm.$emit("drop", dropEvent);
      await flushPromises();

      expect(mockBoardStore.addNoteNode).toHaveBeenCalledWith("My Note", expect.any(Object));
    });

    it("does nothing on drop without valid payload", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();

      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        clientX: 150,
        clientY: 200
      });

      await vueFlow.vm.$emit("drop", dropEvent);
      await flushPromises();

      expect(mockBoardStore.addCompanyNode).not.toHaveBeenCalled();
      expect(mockBoardStore.addMilestoneNode).not.toHaveBeenCalled();
      expect(mockBoardStore.addNoteNode).not.toHaveBeenCalled();
    });
  });

  describe("keyboard events", () => {
    it("deletes selected elements on Delete key", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }]);
      mockGetSelectedEdges.mockReturnValue([]);
      vi.stubGlobal("confirm", () => true);

      wrapper = mountComponent();
      await flushPromises();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("deletes selected elements on Backspace key", async () => {
      mockGetSelectedNodes.mockReturnValue([]);
      mockGetSelectedEdges.mockReturnValue([{ id: "edge-1" }]);
      vi.stubGlobal("confirm", () => true);

      wrapper = mountComponent();
      await flushPromises();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Backspace" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("does not delete when no elements are selected", async () => {
      mockGetSelectedNodes.mockReturnValue([]);
      mockGetSelectedEdges.mockReturnValue([]);

      wrapper = mountComponent();
      await flushPromises();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).not.toHaveBeenCalled();
    });

    it("does not delete when typing in input", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }]);
      mockGetSelectedEdges.mockReturnValue([]);

      wrapper = mountComponent();
      await flushPromises();

      // Create an input element and focus it
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete", bubbles: true });
      input.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("shows confirm dialog when deleting multiple elements", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }, { id: "node-2" }]);
      mockGetSelectedEdges.mockReturnValue([{ id: "edge-1" }]);
      const confirmMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("confirm", confirmMock);

      wrapper = mountComponent();
      await flushPromises();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(confirmMock).toHaveBeenCalledWith("Slette 3 valgte elementer?");
      expect(mockBoardStore.removeSelectedElements).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("does not delete when confirm is cancelled", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }, { id: "node-2" }]);
      mockGetSelectedEdges.mockReturnValue([]);
      vi.stubGlobal("confirm", () => false);

      wrapper = mountComponent();
      await flushPromises();

      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe("selection bar delete button", () => {
    it("deletes selected elements when clicking delete button", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }]);
      mockGetSelectedEdges.mockReturnValue([]);
      vi.stubGlobal("confirm", () => true);

      wrapper = mountComponent();
      await flushPromises();

      const deleteButton = wrapper.find(".board-selection-bar button");
      expect(deleteButton.exists()).toBe(true);

      await deleteButton.trigger("click");
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe("viewport handling", () => {
    it("applies viewport on mount when viewport exists", async () => {
      wrapper = mountComponent();
      await flushPromises();
      await nextTick();

      expect(mockSetViewport).toHaveBeenCalledWith({ x: 0, y: 0, zoom: 0.75 }, { duration: 0 });
    });

    it("calls fitView on mount when no viewport exists", async () => {
      mockBoardStore = createMockBoardStore({
        activeBoard: { id: "board-1", name: "Test Board", viewport: null }
      });

      wrapper = mountComponent();
      await flushPromises();
      await nextTick();

      expect(mockFitView).toHaveBeenCalledWith({ padding: 0.15, duration: 200 });
    });

    it("schedules viewport save on viewport change", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("moveEnd");
      await flushPromises();

      expect(mockBoardStore.scheduleViewportSave).toHaveBeenCalled();
    });

    it("schedules viewport save on viewport change end", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("viewportChangeEnd");
      await flushPromises();

      expect(mockBoardStore.scheduleViewportSave).toHaveBeenCalled();
    });
  });

  describe("Vue Flow events", () => {
    it("calls onConnect when connecting nodes", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const connection = { source: "node-1", target: "node-2" };
      await vueFlow.vm.$emit("connect", connection);
      await flushPromises();

      expect(mockBoardStore.onConnect).toHaveBeenCalledWith(connection);
    });

    it("calls onNodesChange when nodes change", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("nodesChange");
      await flushPromises();

      expect(mockBoardStore.onNodesChange).toHaveBeenCalled();
    });

    it("calls onNodesChange when node drag stops", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("nodeDragStop");
      await flushPromises();

      expect(mockBoardStore.onNodesChange).toHaveBeenCalled();
    });

    it("calls onEdgesChange when edges change", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("edgesChange");
      await flushPromises();

      expect(mockBoardStore.onEdgesChange).toHaveBeenCalled();
    });
  });

  describe("watchers", () => {
    it("reacts to active board changes", async () => {
      mockBoardStore = createMockBoardStore();
      wrapper = mountComponent();
      await flushPromises();

      // Change active board
      mockBoardStore.activeBoard = { id: "board-2", name: "New Board", viewport: { x: 10, y: 20, zoom: 0.8 } };
      await flushPromises();

      // Should close menus and apply viewport
      expect(mockSetViewport).toHaveBeenCalled();
    });

    it("closes menus when active board changes", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Open pane menu
      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("paneClick", new MouseEvent("click", { clientX: 100, clientY: 100 }));
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);

      // Change active board
      mockBoardStore.activeBoard = { id: "board-2", name: "New Board", viewport: { x: 0, y: 0, zoom: 0.75 } };
      await flushPromises();

      // Menu should be closed
      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(false);
    });
  });

  describe("lifecycle hooks", () => {
    it("adds keydown listener on mount", async () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      wrapper = mountComponent();
      await flushPromises();

      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it("removes keydown listener on unmount", async () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      wrapper = mountComponent();
      await flushPromises();

      wrapper.unmount();
      await flushPromises();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("handles touch events for context menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const touch = new Touch({
        identifier: 1,
        target: document.body,
        clientX: 100,
        clientY: 100
      });
      const touchEvent = new TouchEvent("touchstart", {
        touches: [touch],
        changedTouches: [touch]
      });

      const nodeEvent = {
        node: { id: "node-1", type: "company" },
        event: touchEvent
      };

      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(true);
    });

    it("handles edge case: active board is null on viewport change", async () => {
      mockBoardStore = createMockBoardStore({ activeBoard: null });
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      await vueFlow.vm.$emit("moveEnd");
      await flushPromises();

      // Should not throw and should not schedule save when activeBoard is null
      expect(mockBoardStore.scheduleViewportSave).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("handles complete workflow: open context menu, edit, then close", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });

      // Open context menu
      const nodeEvent = {
        node: { id: "node-1", type: "milestone" },
        event: new MouseEvent("contextmenu", { clientX: 100, clientY: 100 })
      };
      await vueFlow.vm.$emit("nodeContextMenu", nodeEvent);
      await flushPromises();

      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(true);

      // Click edit
      const contextMenu = wrapper.findComponent({ name: "BoardContextMenu" });
      await contextMenu.vm.$emit("edit");
      await flushPromises();

      expect(mockBoardStore.startNodeEdit).toHaveBeenCalledWith("node-1");
      expect(wrapper.find(".board-context-menu-mock").exists()).toBe(false);
    });

    it("handles complete workflow: select multiple elements and delete via keyboard", async () => {
      mockGetSelectedNodes.mockReturnValue([{ id: "node-1" }, { id: "node-2" }]);
      mockGetSelectedEdges.mockReturnValue([{ id: "edge-1" }]);
      vi.stubGlobal("confirm", () => true);

      wrapper = mountComponent();
      await flushPromises();

      // Selection bar should show
      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("3 valgt");

      // Delete via keyboard
      const keydownEvent = new KeyboardEvent("keydown", { key: "Delete" });
      window.dispatchEvent(keydownEvent);
      await flushPromises();

      expect(mockBoardStore.removeSelectedElements).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("handles drag workflow: drag over, then drop company", async () => {
      wrapper = mountComponent();
      await flushPromises();

      const vueFlow = wrapper.findComponent({ name: "VueFlow" });
      const dataTransfer = new DataTransfer();
      const companyPayload = { kind: "company", companyId: "company-1" };
      dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify(companyPayload));

      // Drag over
      const dragEvent = new DragEvent("dragover", { dataTransfer });
      await vueFlow.vm.$emit("dragover", dragEvent);

      expect(dragEvent.defaultPrevented).toBe(true);

      // Drop
      const dropEvent = new DragEvent("drop", {
        dataTransfer,
        clientX: 200,
        clientY: 300
      });

      await vueFlow.vm.$emit("drop", dropEvent);
      await flushPromises();

      expect(mockScreenToFlowCoordinate).toHaveBeenCalledWith({ x: 200, y: 300 });
      expect(mockBoardStore.addCompanyNode).toHaveBeenCalled();
    });
  });
});
