<script setup lang="ts">
import type { BachelorFile, BachelorKnowledge } from "@careercenter/shared";
import { ref } from "vue";
import NotesEditModal from "../../components/NotesEditModal.vue";
import BachelorFolderTreeItem from "../../components/education/BachelorFolderTreeItem.vue";
import { useNotesEditModal } from "../../composables/useNotesEditModal.js";
import {
  fileTypeIcon,
  formatFileSize,
  useEducationBachelorStore
} from "../../stores/educationBachelor.js";

const store = useEducationBachelorStore();
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
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function onDragOver(event: DragEvent) {
  event.preventDefault();
  dragOver.value = true;
}

function onDragLeave() {
  dragOver.value = false;
}

async function onDrop(event: DragEvent) {
  event.preventDefault();
  dragOver.value = false;
  if (event.dataTransfer?.files?.length) await store.uploadFiles(event.dataTransfer.files);
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) void store.uploadFiles(input.files);
  input.value = "";
}

function onRenameFile(fileId: string, currentName: string) {
  const name = window.prompt("Nytt filnavn", currentName);
  if (name?.trim()) void store.renameFile(fileId, name.trim());
}

function openFileNotes(file: BachelorFile) {
  openNotesEdit({
    title: `Notater — ${file.originalName}`,
    notes: file.notes,
    save: (notes) => store.updateFileNotes(file.id, notes)
  });
}

function openEntryNotes(entry: BachelorKnowledge) {
  openNotesEdit({
    title: `Notater — ${entry.courseName}`,
    notes: entry.notes,
    save: (notes) => store.updateEntryNotes(entry.id, notes)
  });
}

function onMoveFile(fileId: string) {
  const target = window.prompt("Mappe-ID (tom = rot)", "");
  if (target === null) return;
  void store.moveFile(fileId, target.trim() || null);
}
</script>

<template>
  <section class="stack bachelor-explorer">
    <div class="bachelor-layout">
      <aside class="panel bachelor-sidebar">
        <div class="bachelor-sidebar-header">
          <h2>Mapper</h2>
          <button
            type="button"
            class="ghost mini-btn"
            :class="{ active: store.currentFolderId === null }"
            @click="store.navigateToFolder(null)"
          >
            Rot
          </button>
        </div>
        <form class="folder-create" @submit.prevent="store.createFolder()">
          <input v-model="store.newFolderName" placeholder="Ny mappe" />
          <button class="secondary" type="submit">+</button>
        </form>
        <ul class="folder-tree">
          <BachelorFolderTreeItem v-for="folder in store.folderTree" :key="folder.id" :folder="folder" />
        </ul>
      </aside>

      <div class="bachelor-main stack">
        <nav class="breadcrumbs" aria-label="Filbane">
          <button
            v-for="(crumb, index) in store.breadcrumbs"
            :key="crumb.id ?? 'root'"
            type="button"
            class="breadcrumb"
            @click="store.navigateToFolder(crumb.id)"
          >
            {{ crumb.name }}<span v-if="index < store.breadcrumbs.length - 1" class="sep">/</span>
          </button>
        </nav>

        <div
          class="panel upload-zone"
          :class="{ 'upload-zone-active': dragOver, 'upload-zone-busy': store.uploading }"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <p v-if="store.uploading">Laster opp …</p>
          <template v-else>
            <p><strong>Dra filer hit</strong> eller velg fra datamaskinen</p>
            <p class="upload-hint">PDF, bilder, dokumenter, kode — maks 50 MB per fil</p>
            <button class="primary" type="button" @click="fileInput?.click()">Velg filer</button>
            <input ref="fileInput" type="file" multiple hidden @change="onFileInput" />
          </template>
        </div>

        <article v-if="store.childFolders.length" class="panel">
          <h2>Undermapper</h2>
          <div class="folder-grid">
            <button
              v-for="folder in store.childFolders"
              :key="folder.id"
              type="button"
              class="folder-card"
              @click="store.navigateToFolder(folder.id)"
            >
              <span class="folder-icon">📁</span>
              <span>{{ folder.name }}</span>
            </button>
          </div>
        </article>

        <article class="panel">
          <h2>Filer</h2>
          <div v-if="store.files.length" class="file-grid">
            <div v-for="file in store.files" :key="file.id" class="file-card">
              <div class="file-icon">{{ fileTypeIcon(file.mimeType, file.originalName) }}</div>
              <div class="file-meta">
                <strong>{{ file.originalName }}</strong>
                <small>{{ formatFileSize(file.sizeBytes) }} · {{ new Date(file.createdAt).toLocaleDateString("nb-NO") }}</small>
                <p v-if="file.notes" class="file-notes">{{ file.notes }}</p>
              </div>
              <div class="file-actions column">
                <a class="secondary mini-link" :href="store.downloadUrl(file.id)" download>Last ned</a>
                <button type="button" class="ghost mini-link" @click="onRenameFile(file.id, file.originalName)">Gi nytt navn</button>
                <button type="button" class="ghost mini-link" @click="openFileNotes(file)">
                  {{ file.notes ? "Rediger notater" : "Legg til notater" }}
                </button>
                <button type="button" class="ghost mini-link" @click="onMoveFile(file.id)">Flytt</button>
                <button type="button" class="ghost mini-link danger" @click="store.deleteFile(file.id)">Slett</button>
              </div>
            </div>
          </div>
          <p v-else>Ingen filer i denne mappen ennå.</p>
        </article>

        <article class="panel">
          <h2>Notater (lærdom)</h2>
          <p class="muted-hint">Notater knyttet til {{ store.breadcrumbs[store.breadcrumbs.length - 1]?.name ?? "Rot" }}.</p>
          <form class="form-grid" @submit.prevent="store.addEntry()">
            <label>Fagnavn<input v-model="store.newEntry.courseName" placeholder="Algoritmer og datastrukturer" required /></label>
            <label>Tema / konsept<input v-model="store.newEntry.topic" placeholder="Grafalgoritmer, BFS/DFS" required /></label>
            <label class="wide-field">Notater<textarea v-model="store.newEntry.notes" placeholder="Det du har lært og vil huske" /></label>
            <button class="primary" type="submit">Legg til lærdom</button>
          </form>
          <div v-for="entry in store.entries" :key="entry.id" class="course-card">
            <div>
              <strong>{{ entry.courseName }} — {{ entry.topic }}</strong>
              <p v-if="entry.notes">{{ entry.notes }}</p>
            </div>
            <div class="actions column">
              <button type="button" class="ghost mini-link" @click="openEntryNotes(entry)">
                {{ entry.notes ? "Rediger notater" : "Legg til notater" }}
              </button>
              <button type="button" class="icon" aria-label="Slett oppføring" @click="store.removeEntry(entry.id)">x</button>
            </div>
          </div>
          <p v-if="!store.entries.length">Ingen notater i denne mappen ennå.</p>
        </article>
      </div>
    </div>

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
