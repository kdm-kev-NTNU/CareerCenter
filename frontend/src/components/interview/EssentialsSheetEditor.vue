<script setup lang="ts">
import { defaultEssentialsSheets, type InterviewMode } from "@careercenter/shared";
import { ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import StatusBadge from "../listing/StatusBadge.vue";
import AppButton from "../ui/AppButton.vue";

const props = defineProps<{
  sheet: string;
  isDefault: boolean;
  mode: InterviewMode;
  aiConfigured: boolean;
}>();

const emit = defineEmits<{
  change: [sheet: string, isDefault: boolean];
}>();

const draft = ref<string | null>(null);
const draftSources = ref<string[]>([]);
const drafting = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.mode,
  () => {
    draft.value = null;
    error.value = null;
  }
);

function onInput(event: Event) {
  emit("change", (event.target as HTMLTextAreaElement).value, false);
}

function resetToDefault() {
  emit("change", defaultEssentialsSheets[props.mode], true);
}

async function makeDraft() {
  drafting.value = true;
  error.value = null;
  try {
    const result = await interviewPrepApi.essentialsDraft(props.mode);
    draft.value = result.draft;
    draftSources.value = result.sourceDocTitles;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke lage utkast.";
  } finally {
    drafting.value = false;
  }
}

function useDraft() {
  if (draft.value === null) return;
  emit("change", draft.value, false);
  draft.value = null;
}
</script>

<template>
  <div class="stack">
    <div class="panel-heading-row">
      <span>Essentials-ark</span>
      <StatusBadge :label="isDefault ? 'Standard' : 'Tilpasset'" :variant="isDefault ? 'muted' : 'accent'" />
    </div>
    <textarea
      :value="sheet"
      rows="14"
      aria-label="Essentials-ark"
      placeholder="Nøkkelpunkter du vil ha på papir under intervjuet …"
      @input="onInput"
    />
    <p class="field-hint">
      Standardarket bygger på STAR- og tipsdokumentene. Fyll inn det som står i [hakeparentes], og lagre.
    </p>
    <div class="form-grid">
      <AppButton variant="ghost" :disabled="isDefault" @click="resetToDefault">Tilbakestill til standard</AppButton>
      <AppButton variant="secondary" :loading="drafting" :disabled="!aiConfigured" @click="makeDraft">
        Lag utkast med KI
      </AppButton>
    </div>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-if="draft !== null" class="panel stack">
      <strong>Utkast fra KI</strong>
      <span v-if="draftSources.length" class="field-hint">Basert på: {{ draftSources.join(", ") }}</span>
      <p class="plan-step-prose">{{ draft }}</p>
      <div class="form-grid">
        <AppButton @click="useDraft">Bruk utkastet</AppButton>
        <AppButton variant="ghost" @click="draft = null">Forkast utkast</AppButton>
      </div>
    </div>
  </div>
</template>
