<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "../../stores/app.js";
import { useGraduateProgramSettingsStore } from "../../stores/graduateProgramSettings.js";
import { useGraduateProgramsStore } from "../../stores/graduatePrograms.js";

const settingsStore = useGraduateProgramSettingsStore();
const programsStore = useGraduateProgramsStore();
const appStore = useAppStore();

const newStatusLabel = ref("");
const newLocationLabel = ref("");
const newRequirementLabel = ref("");
const newRequirementDescription = ref("");
const editingCatalog = ref<{ kind: "status" | "location" | "requirement"; id: string; label: string; description: string } | null>(null);

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
</script>

<template>
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
</template>
