<script setup lang="ts">
import type { LearningPlatform } from "@careercenter/shared";
import NotesEditModal from "../../components/NotesEditModal.vue";
import { useNotesEditModal } from "../../composables/useNotesEditModal.js";
import { useEducationPlatformsStore } from "../../stores/educationPlatforms.js";

const store = useEducationPlatformsStore();
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

function openPlatformNotes(platform: LearningPlatform) {
  openNotesEdit({
    title: `Notater — ${platform.name}`,
    notes: platform.notes,
    save: (notes) => store.updatePlatformNotes(platform.id, notes)
  });
}
</script>

<template>
  <section class="stack">
    <form class="panel form-grid" @submit.prevent="store.addPlatform()">
      <label>Navn<input v-model="store.newPlatform.name" placeholder="Coursera" required /></label>
      <label>URL<input v-model="store.newPlatform.url" type="url" placeholder="https://..." /></label>
      <label class="checkbox-field"><input v-model="store.newPlatform.isActive" type="checkbox" /> Aktiv plattform</label>
      <label class="wide-field">Notater<textarea v-model="store.newPlatform.notes" placeholder="Abonnement, kurs du følger" /></label>
      <button class="primary" type="submit">Legg til plattform</button>
    </form>

    <article class="panel">
      <h2>Online learning platforms</h2>
      <div v-for="platform in store.platforms" :key="platform.id" class="course-card">
        <div>
          <strong>{{ platform.name }}</strong>
          <small>{{ platform.isActive ? "Aktiv" : "Inaktiv" }}</small>
          <p v-if="platform.url"><a :href="platform.url" target="_blank" rel="noreferrer">{{ platform.url }}</a></p>
          <p v-if="platform.notes">{{ platform.notes }}</p>
        </div>
        <div class="actions column">
          <button type="button" class="ghost mini-link" @click="openPlatformNotes(platform)">
            {{ platform.notes ? "Rediger notater" : "Legg til notater" }}
          </button>
          <button type="button" class="icon" aria-label="Slett plattform" @click="store.removePlatform(platform.id)">x</button>
        </div>
      </div>
      <p v-if="!store.platforms.length">Ingen plattformer lagt inn ennå.</p>
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
