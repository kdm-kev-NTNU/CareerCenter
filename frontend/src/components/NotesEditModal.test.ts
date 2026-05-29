import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import NotesEditModal from "./NotesEditModal.vue";

describe("NotesEditModal", () => {
  it("emits save with trimmed notes", async () => {
    const wrapper = mount(NotesEditModal, {
      props: {
        open: true,
        title: "Notater — Test",
        notes: "  Old  "
      },
      global: {
        stubs: { Teleport: true }
      }
    });

    await wrapper.find("textarea").setValue("  New notes  ");
    await wrapper.find(".modal-footer .primary").trigger("click");

    expect(wrapper.emitted("save")?.[0]).toEqual(["New notes"]);
  });

  it("emits close when Avbryt is clicked", async () => {
    const wrapper = mount(NotesEditModal, {
      props: {
        open: true,
        title: "Notater",
        notes: ""
      },
      global: {
        stubs: { Teleport: true }
      }
    });

    await wrapper.find(".modal-footer .secondary").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("does not emit save while saving", async () => {
    const wrapper = mount(NotesEditModal, {
      props: {
        open: true,
        title: "Notater",
        notes: "",
        saving: true
      },
      global: {
        stubs: { Teleport: true }
      }
    });

    await wrapper.find(".modal-footer .primary").trigger("click");
    expect(wrapper.emitted("save")).toBeUndefined();
  });
});
