<script setup lang="ts">
import {
  canStartRecording,
  defaultVideoSimulatorSettings,
  phaseNeedsCamera,
  phaseRevealsPrompt,
  transitionVideoSim,
  type VideoSimState,
  type VideoSimulatorSettings
} from "@careercenter/shared";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import MediaDeviceCheck from "../../components/interview/MediaDeviceCheck.vue";
import { toneForVideoPhase } from "../../components/interview/statusTone.js";
import StatusBadge from "../../components/listing/StatusBadge.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import { useMediaStream } from "../../composables/useMediaStream.js";
import { createVideoRecorder, mergeChunks, saveVideoBlob } from "../../lib/videoRecording.js";

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleIndices(count: number, seed: number): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  const random = mulberry32(seed);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

const phase = ref<VideoSimState>("setup");
const settings = ref<VideoSimulatorSettings>({ ...defaultVideoSimulatorSettings });
const settingsDraft = ref({ ...defaultVideoSimulatorSettings });
const { stream: mediaStream, acquire: acquireMedia, release: releaseMedia, error: mediaError } =
  useMediaStream();
const selectedDevices = ref<{ audioDeviceId?: string; videoDeviceId?: string }>({});
const recorder = ref<MediaRecorder | null>(null);
const chunks = ref<Blob[]>([]);
const currentCard = ref(0);
const completedCards = ref<number[]>([]);
const deckSeed = ref<number | null>(null);
const shuffledDeck = ref<number[]>([]);
const thinkLeft = ref(0);
const answerLeft = ref(0);
const reviewUrl = ref<string | null>(null);
const blobKey = ref<string | null>(null);
const transcript = ref("");
const error = ref<string | null>(null);
const saving = ref(false);
const liveVideoEl = ref<HTMLVideoElement | null>(null);

let thinkTimer: ReturnType<typeof setInterval> | null = null;
let answerTimer: ReturnType<typeof setInterval> | null = null;

const promptCount = computed(() => settingsDraft.value.prompts.length);
const activePrompt = computed(() => settings.value.prompts[currentCard.value] ?? "Ingen flere spørsmål.");
const deckDone = computed(() => completedCards.value.length >= settings.value.prompts.length);
const phaseTone = computed(() => toneForVideoPhase(phase.value));
const showPrompt = computed(() => phaseRevealsPrompt(phase.value));

watch(mediaError, (value) => {
  if (value) error.value = value;
});

watch(
  () => mediaStream.value,
  (stream) => {
    if (!liveVideoEl.value) return;
    liveVideoEl.value.srcObject = stream;
    if (stream) void liveVideoEl.value.play().catch(() => undefined);
  }
);

onMounted(async () => {
  try {
    settings.value = await interviewPrepApi.videoSettings();
    settingsDraft.value = { ...settings.value };
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste innstillinger.";
  }
});

function clearTimers() {
  if (thinkTimer) clearInterval(thinkTimer);
  if (answerTimer) clearInterval(answerTimer);
  thinkTimer = null;
  answerTimer = null;
}

onBeforeUnmount(() => {
  clearTimers();
  stopRecordingInternal(false);
  releaseMedia();
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
});

async function syncMediaForPhase(value: VideoSimState) {
  if (phaseNeedsCamera(value)) {
    await acquireMedia({
      audioDeviceId: selectedDevices.value.audioDeviceId,
      videoDeviceId: selectedDevices.value.videoDeviceId,
      needCamera: true,
      needMicrophone: true
    });
  } else {
    releaseMedia();
  }
}

// Sole owner of the camera lifecycle: media is acquired here and recording starts only after it resolves.
watch(phase, async (value, prev) => {
  const needsCamera = phaseNeedsCamera(value);
  const neededBefore = prev !== undefined && phaseNeedsCamera(prev);
  if (needsCamera !== neededBefore) {
    await syncMediaForPhase(value);
  }
  if (value === "recording" && prev !== "recording") await startRecording();
  if (value === "done" && !saving.value) void saveRun();
});

async function confirmSettings() {
  settings.value = await interviewPrepApi.saveVideoSettings(settingsDraft.value);
  deckSeed.value = Date.now();
  shuffledDeck.value = shuffleIndices(settings.value.prompts.length, deckSeed.value);
  completedCards.value = [];
  currentCard.value = 0;
  phase.value = transitionVideoSim(phase.value, { type: "settings_confirmed" });
}

function onDevicesReady(devices: { audioDeviceId?: string; videoDeviceId?: string }) {
  selectedDevices.value = { ...devices };
  phase.value = transitionVideoSim(phase.value, { type: "devices_ready" });
}

function onDevicesChange(devices: { audioDeviceId?: string; videoDeviceId?: string }) {
  selectedDevices.value = { ...devices };
  if (phaseNeedsCamera(phase.value)) {
    void acquireMedia({
      audioDeviceId: selectedDevices.value.audioDeviceId,
      videoDeviceId: selectedDevices.value.videoDeviceId,
      needCamera: true,
      needMicrophone: true
    });
  }
}

function onDevicesFailed(reason: string) {
  error.value = reason;
  phase.value = transitionVideoSim(phase.value, { type: "devices_failed" });
}

function isCardCompleted(promptIndex: number) {
  return completedCards.value.includes(promptIndex);
}

function selectCard(deckIndex: number) {
  const promptIndex = shuffledDeck.value[deckIndex];
  if (promptIndex === undefined || isCardCompleted(promptIndex)) return;
  if (deckDone.value) {
    phase.value = transitionVideoSim(phase.value, { type: "all_done" });
    return;
  }
  currentCard.value = promptIndex;
  phase.value = transitionVideoSim(phase.value, { type: "card_selected" });
  startThinking();
}

function skipThinkingAndRecord() {
  clearTimers();
  phase.value = transitionVideoSim(phase.value, { type: "think_elapsed" });
}

function startThinking() {
  clearTimers();
  thinkLeft.value = settings.value.thinkSeconds;
  thinkTimer = setInterval(() => {
    thinkLeft.value -= 1;
    if (thinkLeft.value <= 0) {
      skipThinkingAndRecord();
    }
  }, 1000);
}

async function startRecording() {
  if (!canStartRecording(phase.value)) return;
  error.value = null;
  chunks.value = [];
  const stream = mediaStream.value;
  if (!stream) {
    error.value = mediaError.value ?? "Kunne ikke starte opptak.";
    phase.value = transitionVideoSim(phase.value, { type: "devices_failed" });
    return;
  }
  try {
    const rec = createVideoRecorder(stream, (chunk) => chunks.value.push(chunk));
    recorder.value = rec;
    rec.start(250);
    answerLeft.value = settings.value.answerSeconds;
    answerTimer = setInterval(() => {
      answerLeft.value -= 1;
      if (answerLeft.value <= 0) void stopRecording();
    }, 1000);
  } catch {
    error.value = "Kunne ikke starte opptak.";
    phase.value = transitionVideoSim(phase.value, { type: "devices_failed" });
  }
}

function stopRecordingInternal(review: boolean) {
  clearTimers();
  recorder.value?.stop();
  recorder.value = null;
  if (review) {
    phase.value = transitionVideoSim(phase.value, { type: "stop_recording" });
  }
}

async function stopRecording() {
  stopRecordingInternal(true);
  const blob = mergeChunks(chunks.value);
  blobKey.value = `video-${Date.now()}`;
  await saveVideoBlob(blobKey.value, blob);
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
  reviewUrl.value = URL.createObjectURL(blob);
  const result = await interviewPrepApi.transcribeVideo({ blobKey: blobKey.value });
  transcript.value = result.transcript;
}

async function saveRun() {
  saving.value = true;
  try {
    await interviewPrepApi.createVideoRun({
      state: phase.value,
      cardIndex: currentCard.value,
      blobKey: blobKey.value ?? undefined,
      transcript: transcript.value,
      settings: settings.value
    });
  } finally {
    saving.value = false;
  }
}

async function retake() {
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
  reviewUrl.value = null;
  transcript.value = "";
  blobKey.value = null;
  phase.value = transitionVideoSim(phase.value, { type: "retake" });
  startThinking();
}

async function nextCard() {
  completedCards.value = [...completedCards.value, currentCard.value];
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
  reviewUrl.value = null;
  transcript.value = "";
  blobKey.value = null;
  if (deckDone.value) {
    phase.value = transitionVideoSim(phase.value, { type: "all_done" });
    await saveRun();
    return;
  }
  phase.value = transitionVideoSim(phase.value, { type: "next_card" });
}

function restartFromDone() {
  phase.value = "setup";
  deckSeed.value = null;
  shuffledDeck.value = [];
  completedCards.value = [];
  currentCard.value = 0;
}
</script>

<template>
  <section class="stack">
    <PageHeader title="Videosøknad" lead="Tenketid → opptak → gjennomgang.">
      <template #meta>
        <StatusBadge :label="phaseTone.label" :variant="phaseTone.variant" />
      </template>
    </PageHeader>

    <p v-if="error" class="error-text">{{ error }}</p>

    <article v-if="phase === 'setup'" class="panel stack">
      <h3>Innstillinger</h3>
      <label>Tenk (sek) <input v-model.number="settingsDraft.thinkSeconds" type="number" min="5" max="180" /></label>
      <label>Svar (sek) <input v-model.number="settingsDraft.answerSeconds" type="number" min="15" max="600" /></label>
      <p class="muted">Antall spørsmål: <strong>{{ promptCount }}</strong></p>
      <details>
        <summary>Administrer spørsmål</summary>
        <label v-for="(prompt, index) in settingsDraft.prompts" :key="index" class="stack-tight">
          Spørsmål {{ index + 1 }}
          <input v-model="settingsDraft.prompts[index]" />
        </label>
      </details>
      <AppButton @click="confirmSettings">Bekreft og gå til enhetssjekk</AppButton>
    </article>

    <MediaDeviceCheck
      v-else-if="phase === 'device_check'"
      :stream="mediaStream"
      need-camera
      need-microphone
      @ready="onDevicesReady"
      @change="onDevicesChange"
      @failed="onDevicesFailed"
    />

    <article v-else-if="phase === 'deck'" class="panel stack">
      <h3>Kortstokk</h3>
      <p>{{ completedCards.length }} av {{ settings.prompts.length }} fullført</p>
      <ul class="deck-grid plain-list">
        <li v-for="(promptIndex, deckIndex) in shuffledDeck" :key="deckIndex">
          <button
            type="button"
            class="deck-card"
            :class="{
              'deck-card--done': isCardCompleted(promptIndex),
              'deck-card--face-down': !isCardCompleted(promptIndex)
            }"
            :disabled="isCardCompleted(promptIndex)"
            @click="selectCard(deckIndex)"
          >
            <span v-if="isCardCompleted(promptIndex)" class="deck-card__mark" aria-hidden="true">✓</span>
            <span class="deck-card__label">Kort {{ deckIndex + 1 }}</span>
          </button>
        </li>
      </ul>
    </article>

    <article v-else-if="phase === 'thinking'" class="panel stack">
      <h3>Betenkningstid</h3>
      <p v-if="showPrompt" class="lead">{{ activePrompt }}</p>
      <p><strong>{{ thinkLeft }}s</strong></p>
      <AppButton @click="skipThinkingAndRecord">Start opptak nå</AppButton>
    </article>

    <article v-else-if="phase === 'recording'" class="panel stack">
      <h3>Opptak</h3>
      <p v-if="showPrompt">{{ activePrompt }}</p>
      <p><strong>{{ answerLeft }}s</strong></p>
      <div class="self-view recording-preview">
        <video ref="liveVideoEl" playsinline muted />
      </div>
      <AppButton @click="stopRecording">Stopp opptak</AppButton>
    </article>

    <article v-else-if="phase === 'review'" class="panel stack">
      <h3>Gjennomgang</h3>
      <p v-if="showPrompt" class="lead">{{ activePrompt }}</p>
      <video v-if="reviewUrl" class="review-video" :src="reviewUrl" controls playsinline />
      <p v-if="transcript"><strong>Transkripsjon:</strong> {{ transcript }}</p>
      <div class="form-grid">
        <AppButton variant="ghost" @click="retake">Ta på nytt</AppButton>
        <AppButton @click="nextCard">Neste kort</AppButton>
      </div>
    </article>

    <article v-else-if="phase === 'done'" class="panel stack">
      <h3>Ferdig</h3>
      <p>Du har gjennomført runden. Opptak lagres lokalt (IndexedDB) og kjøringen er logget.</p>
      <AppButton variant="ghost" @click="restartFromDone">Start på nytt</AppButton>
    </article>
  </section>
</template>

<style scoped>
.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 0.75rem;
}

.deck-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 6.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 2px solid var(--border);
  background: linear-gradient(145deg, var(--surface-strong), var(--surface));
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.deck-card--face-down {
  background: linear-gradient(145deg, #1a3a5c, #0f2740);
  color: #e8f0fa;
  border-color: #2a5078;
}

.deck-card--done {
  opacity: 0.65;
  cursor: default;
  background: var(--surface-strong);
}

.deck-card__mark {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.deck-card__label {
  font-weight: 600;
}

.recording-preview {
  width: min(480px, 100%);
  aspect-ratio: 16 / 9;
  background: var(--surface-strong);
  border-radius: 8px;
  overflow: hidden;
}

.recording-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.self-view video {
  transform: scaleX(-1);
}

.review-video {
  width: min(480px, 100%);
  border-radius: 8px;
}
</style>
