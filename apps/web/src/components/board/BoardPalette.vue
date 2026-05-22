<script setup lang="ts">
import { ref } from "vue";
import CompanyFormModal from "../companies/CompanyFormModal.vue";
import { useBoardStore } from "../../stores/board.js";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useCompaniesStore } from "../../stores/companies.js";
import { setBoardDragData } from "../../utils/boardDrag.js";

const boardStore = useBoardStore();
const companiesStore = useCompaniesStore();
const careerMapStore = useCareerMapStore();
const showTracks = ref(true);
const milestoneLabel = ref("NTNU KI");
const noteText = ref("Kommentar");
const companyModalOpen = ref(false);

function openCompanyModal() {
  companiesStore.resetForm();
  companyModalOpen.value = true;
}

function closeCompanyModal() {
  companyModalOpen.value = false;
}

function addCompany(companyId: string) {
  const company = companiesStore.companies.find((entry) => entry.id === companyId);
  if (company) boardStore.addCompanyNode(company);
}

function onCompanyDragStart(event: DragEvent, companyId: string) {
  if (!event.dataTransfer) return;
  setBoardDragData(event.dataTransfer, { kind: "company", companyId });
}

function onMilestoneDragStart(event: DragEvent) {
  if (!event.dataTransfer) return;
  setBoardDragData(event.dataTransfer, { kind: "milestone", label: milestoneLabel.value.trim() || "Ny milepæl" });
}

function onNoteDragStart(event: DragEvent) {
  if (!event.dataTransfer) return;
  setBoardDragData(event.dataTransfer, { kind: "note", text: noteText.value.trim() || "Notat" });
}
</script>

<template>
  <aside class="board-palette panel">
    <p class="board-palette-hint">
      Venstreklikk på tom flate → <strong>Lag notat her</strong> for å plassere tanker på kartet.
      Dra elementer til kartet, eller klikk for å legge til. Dra en boks på tom flate for å velge flere · Delete for å slette.
      Panorer med høyreklikk eller mushjul-knapp.
    </p>

    <div class="board-palette-section">
      <h2>Bedrifter</h2>
      <input
        v-model="companiesStore.search"
        placeholder="Søk bedrift"
        @input="companiesStore.loadCompanies()"
      />
      <button type="button" class="secondary board-palette-add-company" @click="openCompanyModal">
        + Ny bedrift
      </button>
      <div class="board-palette-list">
        <button
          v-for="company in companiesStore.companies.slice(0, 12)"
          :key="company.id"
          type="button"
          class="secondary board-palette-item"
          draggable="true"
          @click="addCompany(company.id)"
          @dragstart="onCompanyDragStart($event, company.id)"
        >
          <strong>{{ company.name }}</strong>
          <small>Tier {{ company.tier }}</small>
        </button>
      </div>
    </div>

    <div class="board-palette-actions">
      <button
        type="button"
        class="secondary"
        draggable="true"
        @click="boardStore.addMilestoneNode(milestoneLabel)"
        @dragstart="onMilestoneDragStart"
      >
        + Milepæl
      </button>
      <input v-model="milestoneLabel" placeholder="Milepæl-tekst" />
      <button
        type="button"
        class="secondary"
        draggable="true"
        @click="boardStore.addNoteNode(noteText)"
        @dragstart="onNoteDragStart"
      >
        + Notat
      </button>
      <input v-model="noteText" placeholder="Notat-tekst" />
    </div>

    <details class="board-palette-tracks" :open="showTracks" @toggle="showTracks = ($event.target as HTMLDetailsElement).open">
      <summary>Rediger spor</summary>
      <div class="track-list">
        <div v-for="track in careerMapStore.trackList" :key="track.id" class="track-row">
          <template v-if="careerMapStore.editingTrackId === track.id">
            <input v-model="careerMapStore.editingTrackLabel" class="inline-title" />
            <div class="actions">
              <button type="button" class="primary" @click="careerMapStore.saveTrackEditor()">Lagre</button>
              <button type="button" class="secondary" @click="careerMapStore.resetTrackEditor()">Tilbakestill</button>
              <button type="button" class="ghost" @click="careerMapStore.clearTrackEditor()">Avbryt</button>
            </div>
          </template>
          <template v-else>
            <div>
              <strong>{{ careerMapStore.trackName(track.id) }}</strong>
              <small>{{ track.id }}</small>
            </div>
            <div class="track-row-actions">
              <button type="button" class="secondary" @click="careerMapStore.openTrackEditor(track)">Rediger</button>
              <button
                type="button"
                class="ghost"
                :disabled="careerMapStore.trackList.length <= 1"
                @click="careerMapStore.deleteTrack(track)"
              >
                Slett
              </button>
            </div>
          </template>
        </div>
      </div>
    </details>

    <CompanyFormModal :open="companyModalOpen" @close="closeCompanyModal" @saved="closeCompanyModal" />
  </aside>
</template>
