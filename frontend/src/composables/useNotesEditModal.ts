import { reactive, toRefs } from "vue";

type NotesSaveHandler = (notes: string) => Promise<void>;

export function useNotesEditModal() {
  const state = reactive({
    open: false,
    title: "",
    notes: "",
    saving: false,
    error: ""
  });

  let saveHandler: NotesSaveHandler | null = null;

  function openNotesEdit(opts: { title: string; notes: string; save: NotesSaveHandler }) {
    state.title = opts.title;
    state.notes = opts.notes;
    state.error = "";
    saveHandler = opts.save;
    state.open = true;
  }

  function closeNotesEdit() {
    if (state.saving) return;
    state.open = false;
    state.error = "";
    saveHandler = null;
  }

  async function saveNotesEdit(nextNotes: string) {
    if (!saveHandler) return;
    state.saving = true;
    state.error = "";
    try {
      await saveHandler(nextNotes);
      state.open = false;
      saveHandler = null;
    } catch (caught) {
      state.error = caught instanceof Error ? caught.message : "Kunne ikke lagre notater.";
    } finally {
      state.saving = false;
    }
  }

  return {
    ...toRefs(state),
    openNotesEdit,
    closeNotesEdit,
    saveNotesEdit
  };
}
