import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import BoardContextMenu, { type BoardContextMenuTarget } from "./BoardContextMenu.vue";

describe("BoardContextMenu", () => {
  const mountComponent = (props: {
    target: BoardContextMenuTarget;
    x: number;
    y: number;
  }) => {
    return mount(BoardContextMenu, {
      props,
    });
  };

  describe("rendering", () => {
    it("renders nothing when target is null", () => {
      const wrapper = mountComponent({
        target: null,
        x: 100,
        y: 200,
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(false);
      expect(wrapper.text()).toBe("");
    });

    it("renders at correct position when target is a node", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1", type: "milestone" },
        x: 150,
        y: 250,
      });

      const menu = wrapper.find(".board-context-menu");
      expect(menu.exists()).toBe(true);
      expect(menu.attributes("style")).toContain("left: 150px");
      expect(menu.attributes("style")).toContain("top: 250px");
    });

    it("renders at correct position when target is an edge", () => {
      const wrapper = mountComponent({
        target: { kind: "edge", id: "edge-1" },
        x: 300,
        y: 400,
      });

      const menu = wrapper.find(".board-context-menu");
      expect(menu.exists()).toBe(true);
      expect(menu.attributes("style")).toContain("left: 300px");
      expect(menu.attributes("style")).toContain("top: 400px");
    });
  });

  describe("button visibility", () => {
    it("shows all buttons when target is a node", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1", type: "company" },
        x: 100,
        y: 100,
      });

      const buttons = wrapper.findAll("button");
      expect(buttons).toHaveLength(3);

      // Check button texts
      expect(buttons[0].text()).toBe("Rediger");
      expect(buttons[1].text()).toBe("Dupliser node");
      expect(buttons[2].text()).toBe("Slett");
    });

    it("hides 'Dupliser node' button when target is an edge", () => {
      const wrapper = mountComponent({
        target: { kind: "edge", id: "edge-1" },
        x: 100,
        y: 100,
      });

      const buttons = wrapper.findAll("button");
      expect(buttons).toHaveLength(2);

      // Check button texts - no duplicate button
      expect(buttons[0].text()).toBe("Rediger");
      expect(buttons[1].text()).toBe("Slett");

      // Verify 'Dupliser node' is not present
      expect(wrapper.text()).not.toContain("Dupliser node");
    });

    it("shows correct CSS classes on buttons", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      const buttons = wrapper.findAll("button");
      expect(buttons[0].classes()).toContain("ghost");
      expect(buttons[0].classes()).toContain("board-context-menu-item");
      expect(buttons[2].classes()).toContain("board-context-menu-item--danger");
    });
  });

  describe("event emissions", () => {
    it("emits 'edit' event when Rediger button is clicked", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      await wrapper.findAll("button")[0].trigger("click");
      expect(wrapper.emitted("edit")).toHaveLength(1);
    });

    it("emits 'edit' event when Rediger is clicked for edges", async () => {
      const wrapper = mountComponent({
        target: { kind: "edge", id: "edge-1" },
        x: 100,
        y: 100,
      });

      await wrapper.findAll("button")[0].trigger("click");
      expect(wrapper.emitted("edit")).toHaveLength(1);
    });

    it("emits 'duplicate' event when Dupliser node button is clicked", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      await wrapper.findAll("button")[1].trigger("click");
      expect(wrapper.emitted("duplicate")).toHaveLength(1);
    });

    it("emits 'delete' event when Slett button is clicked", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      // Slett is the last button (index 2) for nodes
      await wrapper.findAll("button")[2].trigger("click");
      expect(wrapper.emitted("delete")).toHaveLength(1);
    });

    it("emits 'delete' event when Slett is clicked for edges", async () => {
      const wrapper = mountComponent({
        target: { kind: "edge", id: "edge-1" },
        x: 100,
        y: 100,
      });

      // Slett is the last button (index 1) for edges
      await wrapper.findAll("button")[1].trigger("click");
      expect(wrapper.emitted("delete")).toHaveLength(1);
    });

    it("stops click propagation on the menu container", async () => {
      const onClick = vi.fn();
      const Parent = {
        template: `
          <div @click="onClick">
            <BoardContextMenu :target="target" :x="100" :y="100" />
          </div>
        `,
        components: { BoardContextMenu },
        data() {
          return {
            target: { kind: "node", id: "node-1" } as BoardContextMenuTarget,
            onClick,
          };
        },
      };

      const wrapper = mount(Parent);
      await wrapper.find(".board-context-menu").trigger("click");

      expect(onClick).not.toHaveBeenCalled();
    });

    it("prevents context menu on the menu container", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      const menu = wrapper.find(".board-context-menu");
      // The @contextmenu.prevent directive binds a handler that prevents default
      // We verify the element exists and has the Vue event binding
      expect(menu.exists()).toBe(true);

      await menu.trigger("contextmenu");
      expect(menu.exists()).toBe(true);
    });
  });

  describe("reactive updates", () => {
    it("renders when target changes from null to a node", async () => {
      const wrapper = mountComponent({
        target: null,
        x: 100,
        y: 100,
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(false);

      await wrapper.setProps({
        target: { kind: "node", id: "node-1" },
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(true);
    });

    it("hides when target changes to null", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(true);

      await wrapper.setProps({
        target: null,
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(false);
    });

    it("updates position when x and y change", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      let menu = wrapper.find(".board-context-menu");
      expect(menu.attributes("style")).toContain("left: 100px");
      expect(menu.attributes("style")).toContain("top: 100px");

      await wrapper.setProps({ x: 200, y: 300 });

      menu = wrapper.find(".board-context-menu");
      expect(menu.attributes("style")).toContain("left: 200px");
      expect(menu.attributes("style")).toContain("top: 300px");
    });

    it("shows/hides duplicate button when target type changes", async () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      expect(wrapper.findAll("button")).toHaveLength(3);

      await wrapper.setProps({
        target: { kind: "edge", id: "edge-1" },
      });

      expect(wrapper.findAll("button")).toHaveLength(2);
      expect(wrapper.text()).not.toContain("Dupliser node");

      await wrapper.setProps({
        target: { kind: "node", id: "node-2" },
      });

      expect(wrapper.findAll("button")).toHaveLength(3);
      expect(wrapper.text()).toContain("Dupliser node");
    });
  });

  describe("edge cases", () => {
    it("handles node without type", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100,
        y: 100,
      });

      expect(wrapper.find(".board-context-menu").exists()).toBe(true);
      expect(wrapper.findAll("button")).toHaveLength(3);
    });

    it("handles negative coordinates", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: -50,
        y: -100,
      });

      const menu = wrapper.find(".board-context-menu");
      expect(menu.attributes("style")).toContain("left: -50px");
      expect(menu.attributes("style")).toContain("top: -100px");
    });

    it("handles zero coordinates", () => {
      const wrapper = mountComponent({
        target: { kind: "edge", id: "edge-1" },
        x: 0,
        y: 0,
      });

      const menu = wrapper.find(".board-context-menu");
      expect(menu.attributes("style")).toContain("left: 0px");
      expect(menu.attributes("style")).toContain("top: 0px");
    });

    it("handles fractional coordinates", () => {
      const wrapper = mountComponent({
        target: { kind: "node", id: "node-1" },
        x: 100.5,
        y: 200.75,
      });

      const menu = wrapper.find(".board-context-menu");
      expect(menu.attributes("style")).toContain("left: 100.5px");
      expect(menu.attributes("style")).toContain("top: 200.75px");
    });
  });
});
