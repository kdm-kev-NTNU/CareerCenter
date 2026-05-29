<script setup lang="ts">
import { learningStatuses } from "@careercenter/shared";
import type { EducationBook, LearningStatus } from "@careercenter/shared";
import NotesEditModal from "../../components/NotesEditModal.vue";
import { useNotesEditModal } from "../../composables/useNotesEditModal.js";
import { useEducationBooksStore } from "../../stores/educationBooks.js";

const store = useEducationBooksStore();
const {
  open: notesModalOpen,
  title: notesModalTitle,
  notes: notesModalNotes,
  saving: notesModalSaving,
  error: notesModalError,
  openNotesEdit,
  closeNotesEdit,
  saveNotesEdit
} = useNotesEditModal();

function openBookNotes(book: EducationBook) {
  openNotesEdit({
    title: `Notater — ${book.title}`,
    notes: book.notes,
    save: (notes) => store.updateBookNotes(book.id, notes)
  });
}
const statuses: LearningStatus[] = [...learningStatuses];

const statusLabels: Record<LearningStatus, string> = {
  planned: "Planlagt",
  in_progress: "Leser",
  completed: "Lest"
};
</script>

<template>
  <section class="stack">
    <form class="panel form-grid" @submit.prevent="store.addBook()">
      <label>Tittel<input v-model="store.newBook.title" placeholder="Designing Data-Intensive Applications" required /></label>
      <label>Forfatter<input v-model="store.newBook.author" placeholder="Martin Kleppmann" /></label>
      <label>Status<select v-model="store.newBook.status"><option v-for="status in statuses" :key="status" :value="status">{{ statusLabels[status] }}</option></select></label>
      <label>URL<input v-model="store.newBook.url" type="url" placeholder="https://..." /></label>
      <label class="wide-field">Notater<textarea v-model="store.newBook.notes" placeholder="Nøkkelinnsikt" /></label>
      <button class="primary" type="submit">Legg til bok</button>
    </form>

    <article class="panel">
      <h2>Bøker</h2>
      <div v-for="book in store.books" :key="book.id" class="course-card">
        <div>
          <strong>{{ book.title }}</strong>
          <small v-if="book.author">{{ book.author }} — {{ statusLabels[book.status] }}</small>
          <small v-else>{{ statusLabels[book.status] }}</small>
          <p v-if="book.url"><a :href="book.url" target="_blank" rel="noreferrer">{{ book.url }}</a></p>
          <p v-if="book.notes">{{ book.notes }}</p>
        </div>
        <div class="actions column">
          <button type="button" class="ghost mini-link" @click="openBookNotes(book)">
            {{ book.notes ? "Rediger notater" : "Legg til notater" }}
          </button>
          <button type="button" class="icon" aria-label="Slett bok" @click="store.removeBook(book.id)">x</button>
        </div>
      </div>
      <p v-if="!store.books.length">Ingen bøker lagt inn ennå.</p>
    </article>

    <NotesEditModal
      :open="notesModalOpen"
      :title="notesModalTitle"
      :notes="notesModalNotes"
      :saving="notesModalSaving"
      :error="notesModalError"
      @close="closeNotesEdit()"
      @save="saveNotesEdit"
    />
  </section>
</template>
