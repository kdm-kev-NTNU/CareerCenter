<script setup lang="ts">
import type { CareerTrack, GraduateProgram } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { debounce } from "../utils/debounce.js";
import AppModal from "../components/listing/AppModal.vue";
import CatalogSettingsPanel from "../components/listing/CatalogSettingsPanel.vue";
import ListingRowActions from "../components/listing/ListingRowActions.vue";
import ListingTable from "../components/listing/ListingTable.vue";
import ListingToolbar from "../components/listing/ListingToolbar.vue";
import StatusBadge from "../components/listing/StatusBadge.vue";
import { useListingExpand } from "../composables/useListingExpand.js";
import { useCareerMapStore } from "../stores/careerMap.js";
import { useCompaniesStore } from "../stores/companies.js";
import { useGraduateProgramSettingsStore } from "../stores/graduateProgramSettings.js";
import { useGraduateProgramsStore } from "../stores/graduatePrograms.js";
import { useAppStore } from "../stores/app.js";

const careerMapStore = useCareerMapStore();
const companiesStore = useCompaniesStore();
const settingsStore = useGraduateProgramSettingsStore();
const programsStore = useGraduateProgramsStore();
const appStore = useAppStore();
const { toggleExpand, isExpanded } = useListingExpand();

const modalOpen = ref(false);
const modalError = ref("");
const newStatusLabel = ref("");
const newLocationLabel = ref("");
const newRequirementLabel = ref("");
const newRequirementDescription = ref("");
const editingCatalog = ref<{ kind: "status" | "location" | "requirement"; id: string; label: string; description: string } | null>(null);

const companyOptions = computed(() => companiesStore.companies);
const modalTitle = computed(() =>
  programsStore.isEditing ? "Rediger graduate-program" : "Legg til graduate-program"
);

function locationLabel(program: GraduateProgram) {
  return program.locations?.map((l) => l.label).join(", ") || "Sted ikke valgt";
}

function requirementBadges(program: GraduateProgram) {
  return program.requirements
    .filter((r) => r.isRequired)
    .map((r) => {
      const type = settingsStore.requirementTypes.find((t) => t.id === r.requirementTypeId);
      const label = type?.label ?? "Krav";
      return r.isDone ? `${label} ✓` : label;
    });
}

async function reloadList() {
  try {
    await programsStore.loadGraduatePrograms();
  } catch {
    appStore.setError(programsStore.loadError || "Kunne ikke laste graduate-programmer.");
  }
}

const debouncedReloadList = debounce(reloadList, 300);

onMounted(() => {
  void reloadList();
});

function openAddModal() {
  modalError.value = "";
  programsStore.resetForm();
  programsStore.syncFormFromSettings();
  modalOpen.value = true;
}

function openEditModal(program: GraduateProgram) {
  modalError.value = "";
  programsStore.startEdit(program);
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
  modalError.value = "";
  programsStore.resetForm();
}

async function submitProgram() {
  modalError.value = "";
  try {
    await programsStore.saveGraduateProgram(companyOptions.value);
    await reloadList();
    closeModal();
  } catch (caught) {
    modalError.value = caught instanceof Error ? caught.message : "Kunne ikke lagre graduate-program.";
  }
}

async function deleteProgram(id: string) {
  if (!confirm("Slette dette graduate-programmet?")) return;
  try {
    await programsStore.removeGraduateProgram(id);
  } catch (caught) {
    appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke slette graduate-program.");
  }
}

function setRequirementField(typeId: string, field: "isRequired" | "isDone" | "notes", value: boolean | string) {
  const item = programsStore.requirementFor(typeId);
  if (!item) return;
  if (field === "notes") item.notes = String(value);
  else item[field] = Boolean(value);
}

async function saveCatalogItem() {
  if (!editingCatalog.value) return;
  try {
    const { kind, id, label, description } = editingCatalog.value;
    if (kind === "status") await settingsStore.updateStatus(id, label);
    if (kind === "location") await settingsStore.updateLocation(id, label);
    if (kind === "requirement") await settingsStore.updateRequirementType(id, label, description);
    editingCatalog.value = null;
    programsStore.syncFormFromSettings();
  } catch (caught) {
    appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke oppdatere katalog.");
  }
}

async function addCatalogItem(kind: "status" | "location" | "requirement") {
  try {
    if (kind === "status" && newStatusLabel.value.trim()) {
      await settingsStore.addStatus(newStatusLabel.value.trim());
      newStatusLabel.value = "";
    }
    if (kind === "location" && newLocationLabel.value.trim()) {
      await settingsStore.addLocation(newLocationLabel.value.trim());
      newLocationLabel.value = "";
    }
    if (kind === "requirement" && newRequirementLabel.value.trim()) {
      await settingsStore.addRequirementType(newRequirementLabel.value.trim(), newRequirementDescription.value.trim());
      newRequirementLabel.value = "";
      newRequirementDescription.value = "";
    }
    programsStore.syncFormFromSettings();
  } catch (caught) {
    appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke legge til katalogelement.");
  }
}

async function removeCatalogItem(kind: "status" | "location" | "requirement", id: string) {
  if (!confirm("Slette dette katalogelementet?")) return;
  try {
    if (kind === "status") await settingsStore.removeStatus(id);
    if (kind === "location") await settingsStore.removeLocation(id);
    if (kind === "requirement") await settingsStore.removeRequirementType(id);
    programsStore.syncFormFromSettings();
  } catch (caught) {
    appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke slette katalogelement.");
  }
}

function formatDeadline(value?: string) {
  if (!value) return "Ingen frist";
  return new Date(value).toLocaleDateString("nb-NO");
}
</script>

<template>
  <section class="stack">
    <ListingToolbar @add="openAddModal">
      <template #filters>
        <input v-model="programsStore.search" placeholder="Søk bedrift, program..." @input="debouncedReloadList" />
        <select v-model="programsStore.statusFilter" @change="reloadList">
          <option value="">Alle statuser</option>
          <option v-for="status in settingsStore.statuses" :key="status.id" :value="status.id">{{ status.label }}</option>
        </select>
        <select v-model="programsStore.locationFilter" @change="reloadList">
          <option value="">Alle steder</option>
          <option v-for="location in settingsStore.locations" :key="location.id" :value="location.id">{{ location.label }}</option>
        </select>
      </template>
    </ListingToolbar>

    <ListingTable :columns="['Bedrift / program', 'Status', 'Sted', 'Frist', 'Krav', '']">
      <p v-if="programsStore.isLoading" class="listing-loading">Laster graduate-programmer...</p>
      <p v-else-if="programsStore.loadError" class="listing-error">{{ programsStore.loadError }}</p>
      <p v-else-if="programsStore.graduatePrograms.length === 0" class="listing-empty">Ingen graduate-programmer ennå.</p>
      <div v-for="program in programsStore.graduatePrograms" :key="program.id" class="listing-entry">
        <div
          class="listing-row"
          :class="{ 'listing-row--expanded': isExpanded(program.id) }"
          role="button"
          tabindex="0"
          @click="toggleExpand(program.id)"
          @keydown.enter.prevent="toggleExpand(program.id)"
        >
          <div class="listing-cell-title">
            <strong>{{ program.companyName }}</strong>
            <small>{{ program.title }}</small>
          </div>
          <StatusBadge :label="program.status?.label ?? '—'" variant="accent" />
          <span class="listing-cell-muted">{{ locationLabel(program) }}</span>
          <span class="listing-cell-muted">{{ formatDeadline(program.deadline) }}</span>
          <span class="listing-cell-progress">{{ programsStore.progressLabel(program) }}</span>
          <ListingRowActions
            :url="program.applicationUrl || null"
            @edit="openEditModal(program)"
            @delete="deleteProgram(program.id)"
          />
        </div>
        <div v-if="isExpanded(program.id)" class="listing-detail">
          <div v-if="program.description">
            <p class="listing-detail-label">Beskrivelse</p>
            <p>{{ program.description }}</p>
          </div>
          <div v-if="program.notes">
            <p class="listing-detail-label">Notater</p>
            <p>{{ program.notes }}</p>
          </div>
          <div v-if="requirementBadges(program).length">
            <p class="listing-detail-label">Krav</p>
            <div class="listing-detail-badges">
              <StatusBadge
                v-for="badge in requirementBadges(program)"
                :key="badge"
                :label="badge"
                :variant="badge.includes('✓') ? 'accent' : 'muted'"
              />
            </div>
          </div>
          <a
            v-if="program.applicationUrl"
            class="listing-detail-link"
            :href="program.applicationUrl"
            target="_blank"
            rel="noreferrer"
            @click.stop
          >Åpne søknad →</a>
        </div>
      </div>
    </ListingTable>

    <CatalogSettingsPanel>
      <div>
        <h3>Status</h3>
        <div v-for="status in settingsStore.statuses" :key="status.id" class="catalog-row">
          <template v-if="editingCatalog?.kind === 'status' && editingCatalog.id === status.id">
            <input v-model="editingCatalog.label" />
            <button type="button" class="mini" @click="saveCatalogItem">Lagre</button>
          </template>
          <template v-else>
            <span>{{ status.label }}</span>
            <button type="button" class="mini" @click="editingCatalog = { kind: 'status', id: status.id, label: status.label, description: '' }">Rediger</button>
            <button type="button" class="mini danger" @click="removeCatalogItem('status', status.id)">Slett</button>
          </template>
        </div>
        <div class="catalog-add">
          <input v-model="newStatusLabel" placeholder="Ny status" />
          <button type="button" class="secondary" @click="addCatalogItem('status')">Legg til</button>
        </div>
      </div>
      <div>
        <h3>Sted</h3>
        <div v-for="location in settingsStore.locations" :key="location.id" class="catalog-row">
          <template v-if="editingCatalog?.kind === 'location' && editingCatalog.id === location.id">
            <input v-model="editingCatalog.label" />
            <button type="button" class="mini" @click="saveCatalogItem">Lagre</button>
          </template>
          <template v-else>
            <span>{{ location.label }}</span>
            <button type="button" class="mini" @click="editingCatalog = { kind: 'location', id: location.id, label: location.label, description: '' }">Rediger</button>
            <button type="button" class="mini danger" @click="removeCatalogItem('location', location.id)">Slett</button>
          </template>
        </div>
        <div class="catalog-add">
          <input v-model="newLocationLabel" placeholder="Nytt sted" />
          <button type="button" class="secondary" @click="addCatalogItem('location')">Legg til</button>
        </div>
      </div>
      <div>
        <h3>Kravtyper</h3>
        <div v-for="type in settingsStore.requirementTypes" :key="type.id" class="catalog-row requirement-catalog">
          <template v-if="editingCatalog?.kind === 'requirement' && editingCatalog.id === type.id">
            <input v-model="editingCatalog.label" placeholder="Navn" />
            <input v-model="editingCatalog.description" placeholder="Beskrivelse" />
            <button type="button" class="mini" @click="saveCatalogItem">Lagre</button>
          </template>
          <template v-else>
            <div>
              <span>{{ type.label }}</span>
              <small v-if="type.description">{{ type.description }}</small>
            </div>
            <button type="button" class="mini" @click="editingCatalog = { kind: 'requirement', id: type.id, label: type.label, description: type.description }">Rediger</button>
            <button type="button" class="mini danger" @click="removeCatalogItem('requirement', type.id)">Slett</button>
          </template>
        </div>
        <div class="catalog-add">
          <input v-model="newRequirementLabel" placeholder="Nytt krav" />
          <input v-model="newRequirementDescription" placeholder="Beskrivelse (valgfritt)" />
          <button type="button" class="secondary" @click="addCatalogItem('requirement')">Legg til</button>
        </div>
      </div>
    </CatalogSettingsPanel>

    <AppModal
      :open="modalOpen"
      :title="modalTitle"
      size="lg"
      persist-key="graduate-programs-form"
      @close="closeModal"
    >
      <form class="form-grid" @submit.prevent="submitProgram">
        <p v-if="modalError" class="form-error">{{ modalError }}</p>
        <label>
          Bedrift
          <select v-model="programsStore.companyPicker" @change="programsStore.applyCompanySelection(companyOptions)">
            <option value="">Velg bedrift</option>
            <option v-for="company in companyOptions" :key="company.id" :value="company.id">{{ company.name }}</option>
            <option :value="programsStore.CUSTOM_COMPANY">Annet (fritekst)</option>
          </select>
        </label>
        <label v-if="programsStore.companyPicker === programsStore.CUSTOM_COMPANY || !programsStore.companyPicker">
          Bedriftsnavn
          <input v-model="programsStore.form.companyName" placeholder="Bedriftsnavn" required />
        </label>
        <label>
          Programnavn
          <input v-model="programsStore.form.title" placeholder="Technology Graduate Programme" required />
        </label>
        <label>
          Status
          <select v-model="programsStore.form.statusId" required>
            <option v-for="status in settingsStore.statuses" :key="status.id" :value="status.id">{{ status.label }}</option>
          </select>
        </label>
        <label>
          Søknadsfrist
          <input v-model="programsStore.form.deadline" type="date" />
        </label>
        <label>
          Søknadslenke
          <input v-model="programsStore.form.applicationUrl" type="url" placeholder="https://..." />
        </label>
        <label class="wide-field">
          Beskrivelse
          <textarea v-model="programsStore.form.description" placeholder="Kort om programmet og hva som er interessant" />
        </label>
        <label class="wide-field">
          Notater
          <textarea v-model="programsStore.form.notes" placeholder="Kontaktperson, tips, interne notater" />
        </label>
        <div class="wide-field chip-group">
          <span class="field-label">Sted</span>
          <button
            v-for="location in settingsStore.locations"
            :key="location.id"
            type="button"
            class="chip"
            :class="{ active: programsStore.form.locationIds.includes(location.id) }"
            @click="programsStore.toggleLocation(location.id)"
          >
            {{ location.label }}
          </button>
        </div>
        <div class="wide-field chip-group">
          <span class="field-label">Karrierespor</span>
          <button
            v-for="track in careerMapStore.tracks"
            :key="track"
            type="button"
            class="chip"
            :class="{ active: programsStore.form.trackTags.includes(track) }"
            @click="programsStore.toggleTrack(track as CareerTrack)"
          >
            {{ careerMapStore.trackName(track) }}
          </button>
        </div>
        <div class="wide-field requirement-grid">
          <span class="field-label">Krav og søknadsmateriale</span>
          <div v-for="type in settingsStore.requirementTypes" :key="type.id" class="requirement-row">
            <label class="checkbox-inline">
              <input
                type="checkbox"
                :checked="programsStore.requirementFor(type.id)?.isRequired"
                @change="setRequirementField(type.id, 'isRequired', ($event.target as HTMLInputElement).checked)"
              />
              Gjelder
            </label>
            <div>
              <strong>{{ type.label }}</strong>
              <small v-if="type.description">{{ type.description }}</small>
            </div>
            <label class="checkbox-inline">
              <input
                type="checkbox"
                :checked="programsStore.requirementFor(type.id)?.isDone"
                @change="setRequirementField(type.id, 'isDone', ($event.target as HTMLInputElement).checked)"
              />
              Ferdig
            </label>
            <input
              :value="programsStore.requirementFor(type.id)?.notes"
              placeholder="Notat"
              @input="setRequirementField(type.id, 'notes', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="ghost" @click="closeModal">Avbryt</button>
        <button type="button" class="primary" :disabled="programsStore.isSubmitting" @click="submitProgram">
          {{ programsStore.isEditing ? "Lagre endringer" : "Legg til" }}
        </button>
      </template>
    </AppModal>
  </section>
</template>
