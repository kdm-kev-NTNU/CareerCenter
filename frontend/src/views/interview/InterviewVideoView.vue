<script setup lang="ts">
import {
  canStartRecording,
  defaultVideoSimulatorSettings,
  transitionVideoSim,
  type VideoSimState,
  type VideoSimulatorSettings
} from "@careercenter/shared";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import MediaDeviceCheck from "../../components/interview/MediaDeviceCheck.vue";
import { createVideoRecorder, mergeChunks, saveVideoBlob } from "../../lib/videoRecording.js";

const phase = ref<VideoSimState>("setup");
const settings = ref<VideoSimulatorSettings>({ ...defaultVideoSimulatorSettings });
const settingsDraft = ref({ ...defaultVideoSimulatorSettings });
const deviceCheck = ref<InstanceType<typeof MediaDeviceCheck> | null>(null);
const mediaStream = ref<MediaStream | null>(null);
const recorder = ref<MediaRecorder | null>(null);
const chunks = ref<Blob[]>([]);
const currentCard = ref(0);
const completedCards = ref<number[]>([]);
const thinkLeft = ref(0);
const answerLeft = ref(0);
const reviewUrl = ref<string | null>(null);
const blobKey = ref<string | null>(null);
const transcript = ref("");
const error = ref<string | null>(null);
const saving = ref(false);

let thinkTimer: ReturnType<typeof setInterval> | null = null;
let answerTimer: ReturnType<typeof setInterval> | null = null;

const activePrompt = computed(() => settings.value.prompts[currentCard.value] ?? "Ingen flere spørsmål.");
const deckDone = computed(() => completedCards.value.length >= settings.value.prompts.length);

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
  deviceCheck.value?.releaseTracks();
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
});

async function confirmSettings() {
  settings.value = await interviewPrepApi.saveVideoSettings(settingsDraft.value);
  phase.value = transitionVideoSim(phase.value, { type: "settings_confirmed" });
}

function onDevicesReady(devices: { audioDeviceId?: string; videoDeviceId?: string }) {
  void devices;
  phase.value = transitionVideoSim(phase.value, { type: "devices_ready" });
}

function onDevicesFailed(reason: string) {
  error.value = reason;
  phase.value = transitionVideoSim(phase.value, { type: "devices_failed" });
}

function selectCard() {
  if (deckDone.value) {
    phase.value = transitionVideoSim(phase.value, { type: "all_done" });
    return;
  }
  phase.value = transitionVideoSim(phase.value, { type: "card_selected" });
  startThinking();
}

function startThinking() {
  clearTimers();
  thinkLeft.value = settings.value.thinkSeconds;
  thinkTimer = setInterval(() => {
    thinkLeft.value -= 1;
    if (thinkLeft.value <= 0) {
      clearTimers();
      phase.value = transitionVideoSim(phase.value, { type: "think_elapsed" });
      void startRecording();
    }
  }, 1000);
}

async function startRecording() {
  if (!canStartRecording(phase.value)) return;
  error.value = null;
  chunks.value = [];
  try {
    mediaStream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const rec = createVideoRecorder(mediaStream.value, (chunk) => chunks.value.push(chunk));
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
  mediaStream.value?.getTracks().forEach((t) => t.stop());
  mediaStream.value = null;
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
  const stub = await interviewPrepApi.transcribeVideoStub({ blobKey: blobKey.value });
  transcript.value = stub.transcript;
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
  currentCard.value += 1;
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

watch(phase, (value) => {
  if (value === "done" && !saving.value) void saveRun();
});
</script>

<template>
  <section class="stack">
    <article class="panel strong">
      <h2>Videosøknad</h2>
      <p>Tenketid → opptak → gjennomgang. Fase: {{ phase }}</p>
    </article>

    <p v-if="error" class="error-text">{{ error }}</p>

    <article v-if="phase === 'setup'" class="panel stack">
      <h3>Innstillinger</h3>
      <label>Tenk (sek) <input v-model.number="settingsDraft.thinkSeconds" type="number" min="5" max="180" /></label>
      <label>Svar (sek) <input v-model.number="settingsDraft.answerSeconds" type="number" min="15" max="600" /></label>
      <label v-for="(prompt, index) in settingsDraft.prompts" :key="index">
        Spørsmål {{ index + 1 }}
        <input v-model="settingsDraft.prompts[index]" />
      </label>
      <button type="button" @click="confirmSettings">Bekreft og gå til enhetssjekk</button>
    </article>

    <MediaDeviceCheck
      v-else-if="phase === 'device_check'"
      ref="deviceCheck"
      @ready="onDevicesReady"
      @failed="onDevicesFailed"
    />

    <article v-else-if="phase === 'deck'" class="panel stack">
      <h3>Kortstokk</h3>
      <p>Kort {{ currentCard + 1 }} av {{ settings.prompts.length }}</p>
      <ul class="plain-list">
        <li v-for="(prompt, index) in settings.prompts" :key="index">
          <span v-if="completedCards.includes(index)">✓</span>
          {{ prompt }}
        </li>
      </ul>
      <button type="button" @click="selectCard">Start dette kortet</button>
    </article>

    <article v-else-if="phase === 'thinking'" class="panel stack">
      <h3>Tenketid</h3>
      <p class="lead">{{ activePrompt }}</p>
      <p>Tid igjen: {{ thinkLeft }}s</p>
    </article>

    <article v-else-if="phase === 'recording'" class="panel stack">
      <h3>Opptak</h3>
      <p>{{ activePrompt }}</p>
      <p>Tid igjen: {{ answerLeft }}s</p>
      <button type="button" @click="stopRecording">Stopp opptak</button>
    </article>

    <article v-else-if="phase === 'review'" class="panel stack">
      <h3>Gjennomgang</h3>
      <video v-if="reviewUrl" :src="reviewUrl" controls playsinline />
      <p v-if="transcript"><strong>Transkripsjon (stub):</strong> {{ transcript }}</p>
      <div class="form-grid">
        <button type="button" class="ghost" @click="retake">Ta på nytt</button>
        <button type="button" @click="nextCard">Neste kort</button>
      </div>
    </article>

    <article v-else-if="phase === 'done'" class="panel">
      <h3>Ferdig</h3>
      <p>Du har gjennomført runden. Opptak lagres lokalt (IndexedDB) og kjøringen er logget.</p>
      <button type="button" class="ghost" @click="phase = 'setup'">Start på nytt</button>
    </article>
  </section>
</template>
