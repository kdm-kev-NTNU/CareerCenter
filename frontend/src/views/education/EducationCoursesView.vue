<script setup lang="ts">
import { learningStatuses } from "@careercenter/shared";
import type { LearningStatus, SelfStudyCourse } from "@careercenter/shared";
import NotesEditModal from "../../components/NotesEditModal.vue";
import { useNotesEditModal } from "../../composables/useNotesEditModal.js";
import { useEducationSelfStudyStore } from "../../stores/educationSelfStudy.js";

const store = useEducationSelfStudyStore();
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

function openCourseNotes(course: SelfStudyCourse) {
  openNotesEdit({
    title: `Notater — ${course.title}`,
    notes: course.notes,
    save: (notes) => store.updateCourseNotes(course.id, notes)
  });
}
const statuses: LearningStatus[] = [...learningStatuses];

const statusLabels: Record<LearningStatus, string> = {
  planned: "Planlagt",
  in_progress: "Pågår",
  completed: "Fullført"
};
</script>

<template>
  <section class="stack">
    <form class="panel form-grid" @submit.prevent="store.addCourse()">
      <label>Tittel<input v-model="store.newCourse.title" placeholder="Deep Learning Specialization" required /></label>
      <label>Leverandør<input v-model="store.newCourse.provider" placeholder="Coursera" required /></label>
      <label>Status<select v-model="store.newCourse.status"><option v-for="status in statuses" :key="status" :value="status">{{ statusLabels[status] }}</option></select></label>
      <label>URL<input v-model="store.newCourse.url" type="url" placeholder="https://..." /></label>
      <label class="wide-field">Notater<textarea v-model="store.newCourse.notes" placeholder="Hva du tar med deg" /></label>
      <button class="primary" type="submit">Legg til kurs</button>
    </form>

    <article class="panel">
      <h2>Selvstudium og eksterne kurs</h2>
      <div v-for="course in store.courses" :key="course.id" class="course-card">
        <div>
          <strong>{{ course.title }}</strong>
          <small>{{ course.provider }} — {{ statusLabels[course.status] }}</small>
          <p v-if="course.url"><a :href="course.url" target="_blank" rel="noreferrer">{{ course.url }}</a></p>
          <p v-if="course.notes">{{ course.notes }}</p>
        </div>
        <div class="actions column">
          <button type="button" class="ghost mini-link" @click="openCourseNotes(course)">
            {{ course.notes ? "Rediger notater" : "Legg til notater" }}
          </button>
          <button type="button" class="icon" aria-label="Slett kurs" @click="store.removeCourse(course.id)">x</button>
        </div>
      </div>
      <p v-if="!store.courses.length">Ingen kurs lagt inn ennå.</p>
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
