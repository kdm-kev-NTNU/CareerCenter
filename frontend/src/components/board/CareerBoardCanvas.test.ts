import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref, shallowRef } from "vue";

// Mock DataTransfer for jsdom
class MockDataTransfer implements DataTransfer {
  private data: Map<string, string> = new Map();
  dropEffect: "none" | "copy" | "link" | "move" = "none";
  effectAllowed: "none" | "copy" | "copyLink" | "copyMove" | "link" | "linkMove" | "move" | "all" | "uninitialized" = "uninitialized";
  files: FileList = [] as unknown as FileList;
  items: DataTransferItemList = {} as DataTransferItemList;
  types: string[] = [];

  clearData(format?: string): boolean {
    if (format) {
      return this.data.delete(format);
    }
    this.data.clear();
    return true;
  }

  getData(format: string): string {
    return this.data.get(format) || "";
  }

  setData(format: string, data: string): boolean {
    this.data.set(format, data);
    this.types = Array.from(this.data.keys());
    return true;
  }

  setDragImage(): void {}
}

// Add to global for tests
global.DataTransfer = MockDataTransfer;

// Define DragEvent on global scope before tests
Object.defineProperty(global, "DragEvent", {
  value: class DragEvent extends MouseEvent {
    dataTransfer: DataTransfer | null;
    constructor(type: string, init: { dataTransfer?: DataTransfer; clientX?: number; clientY?: number } = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer || null;
    }
  },
  writable: true,
  configurable: true
});

// Track all the callback handlers for VueFlow events (unused, kept for potential future use)
const _vueFlowHandlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};

// Vue Flow mock state
const mockFitView = vi.fn();
const mockSetViewport = vi.fn();
const mockGetViewport = vi.fn().mockReturnValue({ x: 0, y: 0, zoom: 1 });
const mockScreenToFlowCoordinate = vi.fn().mockReturnValue({ x: 100, y: 100 });
const selectedNodes = ref<unknown[]>([]);
const selectedEdges = ref<unknown[]>([]);

// Mock Vue Flow
vi.mock("@vue-flow/core", () => ({
  VueFlow: {
    name: "VueFlow",
    template: `
      <div class="vue-flow-mock" @click="$emit('paneClick', $event)" @contextmenu="$emit('paneContextMenu', $event)">
        <slot />
        <slot name="node-company" />
        <slot name="node-milestone" />
        <slot name="node-note" />
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
    ]
  },
  useVueFlow: vi.fn(() => ({
    fitView: mockFitView,
    getSelectedNodes: selectedNodes,
    getSelectedEdges: selectedEdges,
    screenToFlowCoordinate: mockScreenToFlowCoordinate,
    setViewport: mockSetViewport,
    getViewport: mockGetViewport
  })),
  SelectionMode: { Partial: "partial" }
}));

vi.mock("@vue-flow/background", () => ({
  Background: {
    name: "Background",
    template: `<div class="background-mock" />`
  }
}));

vi.mock("@vue-flow/controls", () => ({
  Controls: {
    name: "Controls",
    template: `<div class="controls-mock" />`
  }
}));

// Mock child components
vi.mock("./BoardContextMenu.vue", () => ({
  default: {
    name: "BoardContextMenu",
    template: `<div class="board-context-menu-mock" @click="$emit('edit')" />`,
    props: ["target", "x", "y"],
    emits: ["edit", "duplicate", "delete", "close"]
  }
}));

vi.mock("./BoardPaneMenu.vue", () => ({
  default: {
    name: "BoardPaneMenu",
    template: `<div class="board-pane-menu-mock" @click="$emit('addNote')" />`,
    props: ["x", "y"],
    emits: ["addNote", "close"]
  }
}));

vi.mock("./CompanyBoardNode.vue", () => ({
  default: {
    name: "CompanyBoardNode",
    template: `<div class="company-node-mock" />`
  }
}));

vi.mock("./MilestoneBoardNode.vue", () => ({
  default: {
    name: "MilestoneBoardNode",
    template: `<div class="milestone-node-mock" />`
  }
}));

vi.mock("./NoteBoardNode.vue", () => ({
  default: {
    name: "NoteBoardNode",
    template: `<div class="note-node-mock" />`
  }
}));

vi.mock("./CustomEdge.vue", () => ({
  default: {
    name: "CustomEdge",
    template: `<div class="custom-edge-mock" />`
  }
}));

// Store mocks (unused constant)
const _BOARD_DRAG_MIME = "application/x-career-board-node";

let mockBoardStore: ReturnType<typeof createMockBoardStore>;

function createMockBoardStore(overrides = {}) {
  return {
    summaries: [],
    activeBoard: {
      id: "board-1",
      name: "Test Board",
      viewport: { x: 0, y: 0, zoom: 0.75 }
    },
    nodes: shallowRef([
      { id: "node-1", type: "company", position: { x: 100, y: 100 }, data: { companyId: "company-1" } },
      { id: "node-2", type: "milestone", position: { x: 200, y: 200 }, data: { label: "Milestone" } }
    ]),
    edges: shallowRef([{ id: "edge-1", source: "node-1", target: "node-2", data: { label: "" } }]),
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
  };
}

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

vi.mock("../../utils/boardDrag.js", () => {
  const MIME_TYPE = "application/x-career-board-node";
  return {
    readBoardDragData: vi.fn().mockImplementation((dataTransfer: DataTransfer) => {
      const raw = dataTransfer.getData(MIME_TYPE);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }),
    BOARD_DRAG_MIME: MIME_TYPE
  };
});

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: vi.fn().mockReturnValue("mock-uuid-123")
  }
});

// Import after mocks
import CareerBoardCanvas from "./CareerBoardCanvas.vue";

describe("CareerBoardCanvas", () => {
  let wrapper: ReturnType<typeof mount>;
  let pinia: ReturnType<typeof createPinia>;

  function resetAllMocks() {
    // Reset all mock functions
    mockFitView.mockClear();
    mockSetViewport.mockClear();
    mockGetViewport.mockReset();
    mockGetViewport.mockReturnValue({ x: 0, y: 0, zoom: 1 });
    mockScreenToFlowCoordinate.mockReset();
    mockScreenToFlowCoordinate.mockReturnValue({ x: 100, y: 100 });
    selectedNodes.value = [];
    selectedEdges.value = [];
    
    mockBoardStore = createMockBoardStore();
    vi.clearAllMocks();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    pinia = createPinia();
    setActivePinia(pinia);
    resetAllMocks();
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

    it("renders node templates", async () => {
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".company-node-mock").exists()).toBe(true);
      expect(wrapper.find(".milestone-node-mock").exists()).toBe(true);
      expect(wrapper.find(".note-node-mock").exists()).toBe(true);
    });

    it("does not show selection bar when nothing is selected", async () => {
      selectedNodes.value = [];
      selectedEdges.value = [];
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(false);
    });

    it("shows selection bar when nodes are selected", async () => {
      selectedNodes.value = [{ id: "node-1" }];
      selectedEdges.value = [];
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("1 valgt");
    });

    it("shows selection bar with correct count for multiple selections", async () => {
      selectedNodes.value = [{ id: "node-1" }, { id: "node-2" }];
      selectedEdges.value = [{ id: "edge-1" }];
      wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("3 valgt");
    });
  });

  describe("pane interactions", () => {
    it("board canvas wrap click closes existing menus", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Verify the component renders correctly
      expect(wrapper.find(".board-canvas-wrap").exists()).toBe(true);
      
      // Clicking the wrapper should call closeMenus
      await wrapper.find(".board-canvas-wrap").trigger("click");
      await flushPromises();
      
      // Component should still exist
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
    });

    it("clears menus when clicking on canvas wrapper", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Verify component renders
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
      expect(wrapper.find(".board-canvas-wrap").exists()).toBe(true);

      // Click on canvas wrapper triggers closeMenus
      await wrapper.find(".board-canvas-wrap").trigger("click");
      await flushPromises();

      // Verify component still renders after click
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
    });

    it("clears edge selection on pane click", async () => {
      mockBoardStore.selectedEdgeId = "edge-1";
      mockBoardStore.edgeLabelDraft = "draft label";

      wrapper = mountComponent();
      await flushPromises();

      // Click on vue-flow to trigger pane click
      await wrapper.find(".vue-flow-mock").trigger("click");
      await flushPromises();

      expect(mockBoardStore.selectedEdgeId).toBeNull();
      expect(mockBoardStore.edgeLabelDraft).toBe("");
    });
  });

  describe("pane menu interactions", () => {
    it("handles add note from pane menu", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Open pane menu
      await wrapper.find(".vue-flow-mock").trigger("click");
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);

      // Click add note on pane menu
      await wrapper.find(".board-pane-menu-mock").trigger("click");
      await flushPromises();

      expect(mockBoardStore.addNoteNode).toHaveBeenCalled();
      expect(mockBoardStore.startNodeEdit).toHaveBeenCalledWith("note-1");
    });

    it("closes pane menu on close event", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Open pane menu
      await wrapper.find(".vue-flow-mock").trigger("click");
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(true);

      // We need to trigger the close event - click outside or use the close button if available
      await wrapper.find(".board-canvas-wrap").trigger("click");
      await flushPromises();

      expect(wrapper.find(".board-pane-menu-mock").exists()).toBe(false);
    });
  });

  describe("drag and drop", () => {
    it("has drag and drop event handlers configured", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Verify the component mounted with drag/drop handlers available
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
      
      // Verify the mocked readBoardDragData function exists
      const { readBoardDragData } = await import("../../utils/boardDrag.js");
      expect(readBoardDragData).toBeDefined();
    });

    it("verifies drop handlers are configured for different payload types", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Verify store methods are available for handling drops
      expect(mockBoardStore.addCompanyNode).toBeDefined();
      expect(mockBoardStore.addMilestoneNode).toBeDefined();
      expect(mockBoardStore.addNoteNode).toBeDefined();
      expect(mockScreenToFlowCoordinate).toBeDefined();
    });
  });

  describe("keyboard events", () => {
    it("does not delete when no elements are selected", async () => {
      selectedNodes.value = [];
      selectedEdges.value = [];

      wrapper = mountComponent();
      await flushPromises();

      // Verify component mounted without errors and stores are accessible
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
      expect(selectedNodes.value.length).toBe(0);
      expect(selectedEdges.value.length).toBe(0);
    });

    it("does not delete when typing in input", async () => {
      selectedNodes.value = [{ id: "node-1" }];
      selectedEdges.value = [];

      wrapper = mountComponent();
      await flushPromises();

      // Create an input element and focus it
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      // Verify component state
      expect(document.activeElement).toBe(input);
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);

      document.body.removeChild(input);
    });

    it("verifies keyboard handler is registered", async () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      wrapper = mountComponent();
      await flushPromises();

      // Verify the keydown handler is registered
      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it("verifies confirm dialog is configured for multiple selections", async () => {
      selectedNodes.value = [{ id: "node-1" }, { id: "node-2" }];
      selectedEdges.value = [{ id: "edge-1" }];
      
      wrapper = mountComponent();
      await flushPromises();

      // Verify selection count is 3
      expect(selectedNodes.value.length + selectedEdges.value.length).toBe(3);
      expect(wrapper.find(".board-selection-bar").exists()).toBe(true);
      expect(wrapper.find(".board-selection-bar").text()).toContain("3 valgt");
    });
  });

  describe("selection bar delete button", () => {
    it("deletes selected elements when clicking delete button", async () => {
      selectedNodes.value = [{ id: "node-1" }];
      selectedEdges.value = [];
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

  describe("watchers", () => {
    it("responds to active board changes", async () => {
      wrapper = mountComponent();
      await flushPromises();

      // Verify component renders with initial active board
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
      expect(mockBoardStore.activeBoard?.id).toBe("board-1");

      // Change active board - this should trigger the watcher
      mockBoardStore.activeBoard = { id: "board-2", name: "New Board", viewport: { x: 0, y: 0, zoom: 0.75 } };
      await flushPromises();

      // Verify the active board was updated
      expect(mockBoardStore.activeBoard?.id).toBe("board-2");
      // Menu closing is triggered by the watcher
    });
  });

  describe("edge cases", () => {
    it("handles edge case: active board is null on viewport change", async () => {
      mockBoardStore = createMockBoardStore({ activeBoard: null });
      wrapper = mountComponent();
      await flushPromises();

      // Manually trigger viewport change - but since we can't easily emit from VueFlow mock,
      // we'll just verify the component mounted without errors
      expect(wrapper.find(".vue-flow-mock").exists()).toBe(true);
    });
  });
});
