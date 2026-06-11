<script setup lang="ts">
import {
  thesisCompanySourceLabels,
  thesisCompanyStatusLabels,
  type ThesisCompany,
  type ThesisCompanyStatus
} from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import AppModal from "../components/listing/AppModal.vue";
import ListingRowActions from "../components/listing/ListingRowActions.vue";
import ListingTable from "../components/listing/ListingTable.vue";
import ListingToolbar from "../components/listing/ListingToolbar.vue";
import StatusBadge from "../components/listing/StatusBadge.vue";
import { useListingExpand } from "../composables/useListingExpand.js";
import { useCareerMapStore } from "../stores/careerMap.js";
import { useThesisCompaniesStore } from "../stores/thesisCompanies.js";

const store = useThesisCompaniesStore();
const careerMapStore = useCareerMapStore();
const { toggleExpand, isExpanded } = useListingExpand();

const modalOpen = ref(false);
const modalError = ref("");

const modalTitle = computed(() => (store.editingId ? "Rediger bedrift" : "Legg til bedrift"));

function statusBadgeVariant(status: ThesisCompanyStatus): "accent" | "blue" | "muted" {
  if (status === "confirmed") return "accent";
  if (status === "contacted" || status === "interested") return "blue";
  return "muted";
}

function semesterLabel(entry: ThesisCompany): string {
  return entry.targetSemester ? `Semester ${entry.targetSemester}` : "—";
}

function openAddModal() {
  modalError.value = "";
  store.resetForm();
  modalOpen.value = true;
}

function openEditModal(entry: ThesisCompany) {
  modalError.value = "";
  store.startEdit(entry);
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
  modalError.value = "";
  store.resetForm();
}

async function saveCompany() {
  modalError.value = "";
  try {
    await store.saveCompany();
    closeModal();
  } catch (error) {
    modalError.value = error instanceof Error ? error.message : "Kunne ikke lagre bedrift.";
  }
}

async function removeCompany(id: string) {
  if (!confirm("Slette denne bedriften?")) return;
  await store.removeCompany(id);
}

onMounted(() => {
  void store.loadCompanies();
});
</script>

<template>
  <section class="stack">
    <ListingToolbar @add="openAddModal">
      <template #filters>
        <input v-model="store.filters.q" placeholder="Søk bedrift, tema..." />
        <select v-model="store.filters.status">
          <option value="">Alle statuser</option>
          <option v-for="status in store.thesisCompanyStatuses" :key="status" :value="status">
            {{ thesisCompanyStatusLabels[status] }}
          </option>
        </select>
        <select v-model="store.filters.source">
          <option value="">Alle kilder</option>
          <option v-for="source in store.thesisCompanySources" :key="source" :value="source">
            {{ thesisCompanySourceLabels[source] }}
          </option>
        </select>
      </template>
    </ListingToolbar>

    <ListingTable layout="competitions" :columns="['Bedrift', 'Tema', 'Status', 'Kilde', 'Sted', 'Semester', '']">
      <p v-if="store.filteredCompanies.length === 0" class="listing-empty">Ingen bedrifter matcher filteret.</p>
      <div v-for="entry in store.filteredCompanies" :key="entry.id" class="listing-entry">
        <div
          class="listing-row"
          :class="{ 'listing-row--expanded': isExpanded(entry.id) }"
          role="button"
          tabindex="0"
          @click="toggleExpand(entry.id)"
          @keydown.enter.prevent="toggleExpand(entry.id)"
        >
          <div class="listing-cell-title">
            <strong>{{ entry.companyName }}</strong>
          </div>
          <span class="listing-cell-muted">{{ entry.topicArea || "—" }}</span>
          <StatusBadge :label="thesisCompanyStatusLabels[entry.status]" :variant="statusBadgeVariant(entry.status)" />
          <StatusBadge :label="thesisCompanySourceLabels[entry.source]" variant="muted" />
          <span class="listing-cell-muted">{{ entry.location || "—" }}</span>
          <span class="listing-cell-muted">{{ semesterLabel(entry) }}</span>
          <ListingRowActions
            :url="entry.websiteUrl || null"
            @edit="openEditModal(entry)"
            @delete="removeCompany(entry.id)"
          />
        </div>
        <div v-if="isExpanded(entry.id)" class="listing-detail">
          <div class="listing-detail-meta">
            <span v-if="entry.contactPerson">Kontakt: {{ entry.contactPerson }}</span>
            <span v-if="entry.trackTags.length">
              Spor:
              {{ entry.trackTags.map((track) => careerMapStore.trackName(track)).join(", ") }}
            </span>
          </div>
          <div v-if="entry.notes">
            <p class="listing-detail-label">Notater</p>
            <p>{{ entry.notes }}</p>
          </div>
          <a
            v-if="entry.websiteUrl"
            class="listing-detail-link"
            :href="entry.websiteUrl"
            target="_blank"
            rel="noreferrer"
            @click.stop
          >Nettside →</a>
        </div>
      </div>
    </ListingTable>

    <AppModal
      :open="modalOpen"
      :title="modalTitle"
      size="lg"
      persist-key="thesis-companies-form"
      @close="closeModal"
    >
      <p v-if="modalError" class="form-error">{{ modalError }}</p>
      <form class="form-grid" @submit.prevent="saveCompany">
        <label>Bedriftsnavn<input v-model="store.form.companyName" placeholder="Equinor, SINTEF" required /></label>
        <label>Tema / område<input v-model="store.form.topicArea" placeholder="ML i energi, kvantitativ finans" /></label>
        <label>Status<select v-model="store.form.status">
          <option v-for="status in store.thesisCompanyStatuses" :key="status" :value="status">
            {{ thesisCompanyStatusLabels[status] }}
          </option>
        </select></label>
        <label>Kilde<select v-model="store.form.source">
          <option v-for="source in store.thesisCompanySources" :key="source" :value="source">
            {{ thesisCompanySourceLabels[source] }}
          </option>
        </select></label>
        <label>Sted<input v-model="store.form.location" placeholder="Trondheim, Oslo, remote" /></label>
        <label>Kontaktperson<input v-model="store.form.contactPerson" placeholder="Navn" /></label>
        <label>Målsemester<select v-model="store.form.targetSemester">
          <option :value="null">Ikke valgt</option>
          <option :value="7">Semester 7</option>
          <option :value="8">Semester 8</option>
          <option :value="9">Semester 9</option>
          <option :value="10">Semester 10</option>
        </select></label>
        <label>Nettside<input v-model="store.form.websiteUrl" type="url" placeholder="https://..." /></label>
        <div class="wide-field track-picker">
          <span>Karrierespor</span>
          <div class="track-tags">
            <button
              v-for="track in careerMapStore.tracks"
              :key="track"
              type="button"
              class="track-tag"
              :class="{ active: store.form.trackTags.includes(track) }"
              @click="store.toggleTrack(track)"
            >
              {{ careerMapStore.trackName(track) }}
            </button>
          </div>
        </div>
        <label class="wide-field">Notater<textarea v-model="store.form.notes" placeholder="Hvordan du vet om muligheten, neste steg" /></label>
      </form>
      <template #footer>
        <button type="button" class="ghost" @click="closeModal">Avbryt</button>
        <button type="button" class="primary" @click="saveCompany">
          {{ store.editingId ? "Lagre endringer" : "Legg til" }}
        </button>
      </template>
    </AppModal>
  </section>
</template>
