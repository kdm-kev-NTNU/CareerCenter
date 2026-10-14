<script setup lang="ts">
import type { CareerTrack } from "@careercenter/shared";
import { computed, ref } from "vue";
import AppModal from "../listing/AppModal.vue";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useInternshipSettingsStore } from "../../stores/internshipSettings.js";
import { useInternshipsStore } from "../../stores/internships.js";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const careerMapStore = useCareerMapStore();
const settingsStore = useInternshipSettingsStore();
const internshipsStore = useInternshipsStore();
const modalError = ref("");

const modalTitle = computed(() =>
  internshipsStore.isEditing ? "Rediger internship" : "Legg til internship"
);

function statusById(id: string) {
  return settingsStore.statuses.find((status) => status.id === id);
}

function closeModal() {
  modalError.value = "";
  internshipsStore.resetForm();
  emit("close");
}

async function submitInternship() {
  modalError.value = "";
  try {
    await internshipsStore.saveInternship();
    emit("saved");
    closeModal();
  } catch (caught) {
    modalError.value = caught instanceof Error ? caught.message : "Kunne ikke lagre internship.";
  }
}

function setRequirementField(typeId: string, field: "isRequired" | "isDone" | "notes", value: boolean | string) {
  const item = internshipsStore.requirementFor(typeId);
  if (!item) return;
  if (field === "notes") item.notes = String(value);
  else item[field] = Boolean(value);
}
</script>

<template>
  <AppModal
    :open="open"
    :title="modalTitle"
    size="lg"
    persist-key="internships-form"
    @close="closeModal"
  >
    <form class="form-grid" @submit.prevent="submitInternship">
      <p v-if="modalError" class="form-error">{{ modalError }}</p>
      <label>
        Bedriftsnavn
        <input v-model="internshipsStore.form.companyName" placeholder="Bedriftsnavn" required />
      </label>
      <label>
        Stilling / rolle
        <input v-model="internshipsStore.form.title" placeholder="Summer Intern – Technology" required />
      </label>
      <label>
        Status
        <select v-model="internshipsStore.form.statusId" required>
          <option v-for="status in internshipsStore.formStatusOptions" :key="status.id" :value="status.id">{{ status.label }}</option>
        </select>
      </label>
      <label>
        Søknadsfrist
        <input v-model="internshipsStore.form.deadline" type="date" />
      </label>
      <label>
        Søknadslenke
        <input v-model="internshipsStore.form.applicationUrl" type="url" placeholder="https://..." />
      </label>
      <label class="wide-field">
        Beskrivelse
        <textarea v-model="internshipsStore.form.description" placeholder="Kort om stillingen og hva som er interessant" />
      </label>
      <label class="wide-field">
        Notater
        <textarea v-model="internshipsStore.form.notes" placeholder="Kontaktperson, tips, interne notater" />
      </label>
      <div class="wide-field">
        <span class="field-label">Søknadsflyt</span>
        <p class="field-hint">Velg og sorter stegene som gjelder for denne stillingen. Standardmalen brukes som utgangspunkt.</p>
        <div v-for="id in internshipsStore.form.stageIds" :key="id" class="flow-row">
          <label class="checkbox-inline">
            <input type="checkbox" checked @change="internshipsStore.toggleStage(id)" />
            Gjelder
          </label>
          <span>{{ statusById(id)?.label ?? "Steg" }}</span>
          <button type="button" class="mini" @click="internshipsStore.moveStage(id, -1)">Opp</button>
          <button type="button" class="mini" @click="internshipsStore.moveStage(id, 1)">Ned</button>
        </div>
        <div v-for="status in internshipsStore.unusedTemplateStages" :key="status.id" class="flow-row">
          <label class="checkbox-inline">
            <input type="checkbox" @change="internshipsStore.toggleStage(status.id)" />
            Gjelder
          </label>
          <span>{{ status.label }}</span>
        </div>
      </div>
      <div class="wide-field chip-group">
        <span class="field-label">Sted</span>
        <button
          v-for="location in settingsStore.locations"
          :key="location.id"
          type="button"
          class="chip"
          :class="{ active: internshipsStore.form.locationIds.includes(location.id) }"
          @click="internshipsStore.toggleLocation(location.id)"
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
          :class="{ active: internshipsStore.form.trackTags.includes(track) }"
          @click="internshipsStore.toggleTrack(track as CareerTrack)"
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
              :checked="internshipsStore.requirementFor(type.id)?.isRequired"
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
              :checked="internshipsStore.requirementFor(type.id)?.isDone"
              @change="setRequirementField(type.id, 'isDone', ($event.target as HTMLInputElement).checked)"
            />
            Ferdig
          </label>
          <input
            :value="internshipsStore.requirementFor(type.id)?.notes"
            placeholder="Notat"
            @input="setRequirementField(type.id, 'notes', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </form>
    <template #footer>
      <button type="button" class="ghost" @click="closeModal">Avbryt</button>
      <button type="button" class="primary" :disabled="internshipsStore.isSubmitting" @click="submitInternship">
        {{ internshipsStore.isEditing ? "Lagre endringer" : "Legg til" }}
      </button>
    </template>
  </AppModal>
</template>
