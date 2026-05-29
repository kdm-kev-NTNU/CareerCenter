<script setup lang="ts">
import { careerTracks, trackLabels } from "@careercenter/shared";
import AppModal from "../listing/AppModal.vue";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useCompaniesStore } from "../../stores/companies.js";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    submitLabel?: string;
    error?: string | null;
    delegateSave?: boolean;
  }>(),
  {
    title: "Legg til bedrift",
    submitLabel: "Legg til bedrift",
    error: null,
    delegateSave: false
  }
);

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const companiesStore = useCompaniesStore();
const careerMapStore = useCareerMapStore();

const difficulties = ["Medium", "Medium/high", "High", "Very high"] as const;
const upsides = ["High", "Very high"] as const;

async function save() {
  if (props.delegateSave) {
    emit("saved");
    return;
  }
  const created = await companiesStore.saveCompany();
  if (created) {
    emit("saved");
    emit("close");
  }
}

function onClose() {
  companiesStore.resetForm();
  emit("close");
}
</script>

<template>
  <AppModal
    :open="open"
    :title="props.title"
    size="md"
    persist-key="company-form"
    @close="onClose"
  >
    <p v-if="props.error || companiesStore.error" class="form-error">{{ props.error || companiesStore.error }}</p>
    <form class="form-grid" @submit.prevent="save">
      <label class="wide-field">
        Navn
        <input v-model="companiesStore.form.name" placeholder="Bedriftsnavn" required />
      </label>
      <label class="wide-field">
        Beskrivelse
        <textarea v-model="companiesStore.form.description" placeholder="Kort om bedriften og relevans" required />
      </label>
      <label>
        Geografi
        <input v-model="companiesStore.form.geography" placeholder="Oslo / Norge" required />
      </label>
      <label>
        Nettside
        <input v-model="companiesStore.form.websiteUrl" type="url" placeholder="https://..." />
      </label>
      <label>
        Tier
        <select v-model.number="companiesStore.form.tier">
          <option :value="1">Tier 1 — Norge-start</option>
          <option :value="2">Tier 2 — Norden/Europa</option>
          <option :value="3">Tier 3 — global elite</option>
        </select>
      </label>
      <label>
        Relevansscore
        <input v-model.number="companiesStore.form.relevanceScore" type="number" min="0" max="100" />
      </label>
      <label>
        Vanskelighet
        <select v-model="companiesStore.form.difficulty">
          <option v-for="level in difficulties" :key="level" :value="level">{{ level }}</option>
        </select>
      </label>
      <label>
        Oppside
        <select v-model="companiesStore.form.upside">
          <option v-for="level in upsides" :key="level" :value="level">{{ level }}</option>
        </select>
      </label>
      <fieldset class="wide-field company-tracks">
        <legend>Karrierespor</legend>
        <label v-for="track in careerTracks" :key="track" class="track-checkbox">
          <input
            type="checkbox"
            :checked="companiesStore.form.tracks.includes(track)"
            @change="companiesStore.toggleTrack(track)"
          />
          {{ careerMapStore.trackName(track) || trackLabels[track] }}
        </label>
      </fieldset>
      <div class="wide-field company-roles">
        <label>
          Rolletyper
          <div class="role-type-input">
            <input
              v-model="companiesStore.roleTypeDraft"
              placeholder="Data Scientist"
              @keydown.enter.prevent="companiesStore.addRoleType()"
            />
            <button type="button" class="secondary" @click="companiesStore.addRoleType()">Legg til</button>
          </div>
        </label>
        <div v-if="companiesStore.form.roleTypes.length" class="role-type-tags">
          <span v-for="role in companiesStore.form.roleTypes" :key="role" class="role-tag">
            {{ role }}
            <button type="button" class="mini" aria-label="Fjern rolle" @click="companiesStore.removeRoleType(role)">×</button>
          </span>
        </div>
      </div>
    </form>
    <template #footer>
      <button type="button" class="ghost" @click="onClose">Avbryt</button>
      <button type="button" class="primary" :disabled="companiesStore.saving" @click="save">
        {{ companiesStore.saving ? "Lagrer…" : props.submitLabel }}
      </button>
    </template>
  </AppModal>
</template>
