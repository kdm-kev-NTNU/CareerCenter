<script setup lang="ts">
import type { CareerTrack } from "@careercenter/shared";
import { computed, ref } from "vue";
import AppModal from "../listing/AppModal.vue";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useGraduateProgramSettingsStore } from "../../stores/graduateProgramSettings.js";
import { useGraduateProgramsStore } from "../../stores/graduatePrograms.js";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const careerMapStore = useCareerMapStore();
const settingsStore = useGraduateProgramSettingsStore();
const programsStore = useGraduateProgramsStore();
const modalError = ref("");

const modalTitle = computed(() =>
  programsStore.isEditing ? "Rediger graduate-program" : "Legg til graduate-program"
);

function closeModal() {
  modalError.value = "";
  programsStore.resetForm();
  emit("close");
}

async function submitProgram() {
  modalError.value = "";
  try {
    await programsStore.saveGraduateProgram();
    emit("saved");
    closeModal();
  } catch (caught) {
    modalError.value = caught instanceof Error ? caught.message : "Kunne ikke lagre graduate-program.";
  }
}

function setRequirementField(typeId: string, field: "isRequired" | "isDone" | "notes", value: boolean | string) {
  const item = programsStore.requirementFor(typeId);
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
    persist-key="graduate-programs-form"
    @close="closeModal"
  >
    <form class="form-grid" @submit.prevent="submitProgram">
      <p v-if="modalError" class="form-error">{{ modalError }}</p>
      <label>
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
</template>
