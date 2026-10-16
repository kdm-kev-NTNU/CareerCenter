<script setup lang="ts">
import type { CandidateBackgroundDto } from "@careercenter/shared";
import { hasCandidateCv } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import AppButton from "../ui/AppButton.vue";

const background = ref<CandidateBackgroundDto | null>(null);
const notes = ref("");
const loading = ref(true);
const saving = ref(false);
const uploading = ref<"cv" | "transcript" | null>(null);
const error = ref<string | null>(null);
const showPreview = ref(false);
const cvInput = ref<HTMLInputElement | null>(null);
const transcriptInput = ref<HTMLInputElement | null>(null);

const missingCv = computed(() => (background.value ? !hasCandidateCv(background.value) : true));

function formatDate(iso: string | null): string {
  if (!iso) return "ikke lastet opp";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nb-NO", { year: "numeric", month: "short", day: "numeric" });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    background.value = await interviewPrepApi.background();
    notes.value = background.value.notes;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente bakgrunn.";
  } finally {
    loading.value = false;
  }
}

async function saveNotes() {
  saving.value = true;
  error.value = null;
  try {
    background.value = await interviewPrepApi.saveBackgroundNotes(notes.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke lagre tillegg.";
  } finally {
    saving.value = false;
  }
}

async function onFileChange(kind: "cv" | "transcript", event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploading.value = kind;
  error.value = null;
  try {
    background.value =
      kind === "cv"
        ? await interviewPrepApi.uploadBackgroundCv(file)
        : await interviewPrepApi.uploadBackgroundTranscript(file);
    notes.value = background.value.notes;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste opp PDF.";
  } finally {
    uploading.value = null;
  }
}

onMounted(() => void load());
</script>

<template>
  <article class="panel stack">
    <h3>Din bakgrunn</h3>
    <p class="field-hint">
      Last opp CV og karakterutskrift (PDF). Teksten brukes til svarforslag i bedriftsrapporten og som
      kandidatprofil i simulatoren. Personnummer fjernes automatisk.
    </p>
    <p v-if="loading" class="field-hint">Laster bakgrunn …</p>
    <template v-else-if="background">
      <p v-if="missingCv" class="error-text">
        Ingen CV lastet opp — svarforslagene blir generiske til du laster opp en CV.
      </p>
      <div class="form-grid">
        <div class="stack">
          <p>
            <strong>CV:</strong>
            {{ background.cvFileName || "—" }}
            <span class="field-hint">({{ formatDate(background.cvUpdatedAt) }})</span>
          </p>
          <input
            ref="cvInput"
            type="file"
            accept="application/pdf,.pdf"
            class="sr-only"
            @change="onFileChange('cv', $event)"
          />
          <AppButton
            variant="secondary"
            :loading="uploading === 'cv'"
            @click="cvInput?.click()"
          >
            Last opp ny CV (pdf)
          </AppButton>
        </div>
        <div class="stack">
          <p>
            <strong>Karakterutskrift:</strong>
            {{ background.transcriptFileName || "—" }}
            <span class="field-hint">({{ formatDate(background.transcriptUpdatedAt) }})</span>
          </p>
          <input
            ref="transcriptInput"
            type="file"
            accept="application/pdf,.pdf"
            class="sr-only"
            @change="onFileChange('transcript', $event)"
          />
          <AppButton
            variant="secondary"
            :loading="uploading === 'transcript'"
            @click="transcriptInput?.click()"
          >
            Last opp ny karakterutskrift (pdf)
          </AppButton>
        </div>
      </div>
      <label>
        Tillegg (motivasjon, mål, annet som ikke står i CV)
        <textarea v-model="notes" rows="3" placeholder="F.eks. hvorfor KI, konsulent vs in-house …" />
      </label>
      <AppButton :loading="saving" @click="saveNotes">Lagre tillegg</AppButton>
      <AppButton variant="ghost" class="mini-btn" @click="showPreview = !showPreview">
        {{ showPreview ? "Skjul forhåndsvisning" : "Vis uttrukket tekst" }}
      </AppButton>
      <pre v-if="showPreview" class="preview-block">{{
        [background.cvText, background.transcriptText, background.notes].filter((t) => t.trim()).join("\n\n---\n\n") ||
        "(tom)"
      }}</pre>
    </template>
    <p v-if="error" class="error-text">{{ error }}</p>
  </article>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.preview-block {
  max-height: 16rem;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 0.8rem;
  background: var(--surface-muted, #f4f4f5);
  padding: 0.75rem;
  border-radius: 0.4rem;
}
</style>
