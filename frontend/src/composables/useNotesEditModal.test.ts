import { describe, expect, it, vi } from "vitest";
import { useNotesEditModal } from "./useNotesEditModal.js";

describe("useNotesEditModal", () => {
  it("opens, saves, and closes on success", async () => {
    const modal = useNotesEditModal();
    const save = vi.fn().mockResolvedValue(undefined);

    modal.openNotesEdit({ title: "Notater — Test", notes: "Old", save });
    expect(modal.open.value).toBe(true);
    expect(modal.title.value).toBe("Notater — Test");
    expect(modal.notes.value).toBe("Old");

    await modal.saveNotesEdit("New");
    expect(save).toHaveBeenCalledWith("New");
    expect(modal.open.value).toBe(false);
    expect(modal.saving.value).toBe(false);
  });

  it("keeps modal open and sets error on failure", async () => {
    const modal = useNotesEditModal();
    modal.openNotesEdit({
      title: "Notater",
      notes: "",
      save: vi.fn().mockRejectedValue(new Error("Nettverksfeil"))
    });

    await modal.saveNotesEdit("New");
    expect(modal.open.value).toBe(true);
    expect(modal.error.value).toBe("Nettverksfeil");
  });
});
