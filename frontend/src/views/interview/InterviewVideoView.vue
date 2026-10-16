<script setup lang="ts">
import {
  canStartRecording,
  defaultVideoSimulatorSettings,
  modeUsesAi,
  phaseNeedsCamera,
  phaseRevealsPrompt,
  researchModelLabels,
  researchModels,
  starRubricCriterionLabels,
  transitionVideoSim,
  type AnswerStats,
  type InterviewSessionFeedbackDto,
  type PracticeMode,
  type StarRubricCriterion,
  type VideoRatingStatus,
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
import {
  createAudioRecorder,
  createVideoRecorder,
  mergeChunks,
  saveVideoBlob
} from "../../lib/videoRecording.js";

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
const practiceMode = ref<PracticeMode>("scored");
const settings = ref<VideoSimulatorSettings>({ ...defaultVideoSimulatorSettings });
const settingsDraft = ref({ ...defaultVideoSimulatorSettings });
const companyName = ref("");
const roleDescription = ref("");
const roundQuestions = ref<string[]>([]);
const generatingQuestions = ref(false);
const { stream: mediaStream, acquire: acquireMedia, release: releaseMedia, error: mediaError } =
  useMediaStream();
const selectedDevices = ref<{ audioDeviceId?: string; videoDeviceId?: string }>({});
const recorder = ref<MediaRecorder | null>(null);
const audioRecorder = ref<MediaRecorder | null>(null);
const chunks = ref<Blob[]>([]);
const audioChunks = ref<Blob[]>([]);
const currentCard = ref(0);
const completedCards = ref<number[]>([]);
const deckSeed = ref<number | null>(null);
const shuffledDeck = ref<number[]>([]);
const thinkLeft = ref(0);
const answerLeft = ref(0);
const reviewUrl = ref<string | null>(null);
const blobKey = ref<string | null>(null);
const transcript = ref("");
const feedback = ref<InterviewSessionFeedbackDto | null>(null);
const ratingStatus = ref<VideoRatingStatus | null>(null);
const stats = ref<AnswerStats | null>(null);
const error = ref<string | null>(null);
const saving = ref(false);
const rating = ref(false);
const recordedDurationMs = ref(0);
const retainedAudioBlob = ref<Blob | null>(null);
const liveVideoEl = ref<HTMLVideoElement | null>(null);

let thinkTimer: ReturnType<typeof setInterval> | null = null;
let answerTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartedAt = 0;

const activePrompt = computed(() => roundQuestions.value[currentCard.value] ?? "Ingen flere spørsmål.");
const deckDone = computed(() => completedCards.value.length >= roundQuestions.value.length);
const phaseTone = computed(() => toneForVideoPhase(phase.value));
const showPrompt = computed(() => phaseRevealsPrompt(phase.value));
const usesAi = computed(() => modeUsesAi(practiceMode.value));
const scoreEntries = computed(() => {
  if (!feedback.value) return [];
  return (Object.keys(starRubricCriterionLabels) as StarRubricCriterion[]).map((key) => ({
    key,
    label: starRubricCriterionLabels[key],
    score: feedback.value!.scores[key]
  }));
});
const ratingModelLabel = computed(
  () => researchModelLabels[settings.value.ratingModel] ?? settings.value.ratingModel
);
const startBusy = computed(() => generatingQuestions.value || saving.value || rating.value);

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
});

async function confirmSettings(mode: PracticeMode) {
  error.value = null;
  const company = companyName.value.trim();
  if (!company) {
    error.value = "Skriv inn bedrift før du starter.";
    return;
  }
  generatingQuestions.value = true;
  try {
    practiceMode.value = mode;
    settings.value = await interviewPrepApi.saveVideoSettings(settingsDraft.value);
    const generated = await interviewPrepApi.generateVideoQuestions({
      companyName: company,
      roleDescription: roleDescription.value.trim(),
      count: settings.value.questionCount,
      model: settings.value.ratingModel
    });
    roundQuestions.value = generated.questions;
    deckSeed.value = Date.now();
    shuffledDeck.value = shuffleIndices(roundQuestions.value.length, deckSeed.value);
    completedCards.value = [];
    currentCard.value = 0;
    phase.value = transitionVideoSim(phase.value, { type: "settings_confirmed" });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke starte runden.";
  } finally {
    generatingQuestions.value = false;
  }
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

function waitForRecorderStop(rec: MediaRecorder): Promise<void> {
  if (rec.state === "inactive") return Promise.resolve();
  return new Promise((resolve) => {
    rec.addEventListener("stop", () => resolve(), { once: true });
    rec.stop();
  });
}

async function startRecording() {
  if (!canStartRecording(phase.value)) return;
  error.value = null;
  chunks.value = [];
  audioChunks.value = [];
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
    if (stream.getAudioTracks().length > 0) {
      const audioRec = createAudioRecorder(stream, (chunk) => audioChunks.value.push(chunk));
      audioRecorder.value = audioRec;
      audioRec.start(250);
    }
    recordingStartedAt = Date.now();
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
  audioRecorder.value?.stop();
  audioRecorder.value = null;
  if (review) {
    phase.value = transitionVideoSim(phase.value, { type: "stop_recording" });
  }
}

async function stopRecording() {
  const videoRec = recorder.value;
  const audioRec = audioRecorder.value;
  clearTimers();
  recordedDurationMs.value = recordingStartedAt ? Date.now() - recordingStartedAt : 0;
  const stopJobs: Promise<void>[] = [];
  if (videoRec) stopJobs.push(waitForRecorderStop(videoRec));
  if (audioRec) stopJobs.push(waitForRecorderStop(audioRec));
  recorder.value = null;
  audioRecorder.value = null;
  await Promise.all(stopJobs);

  phase.value = transitionVideoSim(phase.value, { type: "stop_recording" });

  const blob = mergeChunks(chunks.value);
  blobKey.value = `video-${Date.now()}`;
  await saveVideoBlob(blobKey.value, blob);
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
  reviewUrl.value = URL.createObjectURL(blob);

  transcript.value = "";
  feedback.value = null;
  ratingStatus.value = null;
  stats.value = null;
  retainedAudioBlob.value = null;

  if (!usesAi.value) return;

  const audioBlob = audioChunks.value.length ? mergeChunks(audioChunks.value) : blob;
  retainedAudioBlob.value = audioBlob;
  await runTranscription(audioBlob);
}

async function runTranscription(audioBlob: Blob) {
  rating.value = true;
  error.value = null;
  try {
    const result = await interviewPrepApi.transcribeVideo({
      file: audioBlob,
      filename: "answer.webm",
      mimeType: audioBlob.type || "audio/webm",
      durationMs: recordedDurationMs.value || settings.value.answerSeconds * 1000,
      prompt: activePrompt.value,
      withRubric: true,
      model: settings.value.ratingModel
    });
    transcript.value = result.transcript;
    feedback.value = result.feedback ?? null;
    ratingStatus.value = result.rating;
    stats.value = result.stats ?? null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Transkribering feilet.";
    ratingStatus.value = null;
  } finally {
    rating.value = false;
  }
}

async function retryTranscription() {
  if (!retainedAudioBlob.value) return;
  await runTranscription(retainedAudioBlob.value);
}

async function retryRating() {
  if (!transcript.value.trim()) return;
  rating.value = true;
  error.value = null;
  try {
    const result = await interviewPrepApi.rateVideo({
      prompt: activePrompt.value,
      transcript: transcript.value,
      durationMs: recordedDurationMs.value || settings.value.answerSeconds * 1000,
      model: settings.value.ratingModel
    });
    feedback.value = result.feedback ?? null;
    ratingStatus.value = result.rating;
    if (result.stats) stats.value = result.stats;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Vurdering feilet.";
  } finally {
    rating.value = false;
  }
}

function clearReviewState() {
  if (reviewUrl.value) URL.revokeObjectURL(reviewUrl.value);
  reviewUrl.value = null;
  transcript.value = "";
  feedback.value = null;
  ratingStatus.value = null;
  stats.value = null;
  blobKey.value = null;
  retainedAudioBlob.value = null;
}

async function saveCardRun() {
  if (!usesAi.value) return;
  saving.value = true;
  error.value = null;
  try {
    await interviewPrepApi.createVideoRun({
      state: "review",
      cardIndex: currentCard.value,
      blobKey: blobKey.value ?? undefined,
      transcript: transcript.value,
      prompt: activePrompt.value,
      companyName: companyName.value.trim(),
      roleDescription: roleDescription.value.trim(),
      feedback: ratingStatus.value === "ok" ? (feedback.value ?? undefined) : undefined,
      settings: settings.value
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke lagre kort.";
    throw err;
  } finally {
    saving.value = false;
  }
}

async function retake() {
  clearReviewState();
  phase.value = transitionVideoSim(phase.value, { type: "retake" });
  startThinking();
}

async function nextCard() {
  try {
    await saveCardRun();
  } catch {
    return;
  }
  completedCards.value = [...completedCards.value, currentCard.value];
  clearReviewState();
  if (completedCards.value.length >= roundQuestions.value.length) {
    phase.value = transitionVideoSim(phase.value, { type: "all_done" });
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
  roundQuestions.value = [];
  practiceMode.value = "scored";
}
</script>

<template>
  <section class="stack">
    <PageHeader title="Videosøknad" lead="Tenketid → opptak → gjennomgang.">
      <template #meta>
        <StatusBadge :label="phaseTone.label" :variant="phaseTone.variant" />
        <StatusBadge
          v-if="phase !== 'setup' && practiceMode === 'practice'"
          label="Øving"
          variant="muted"
        />
      </template>
    </PageHeader>

    <p v-if="error" class="error-text">{{ error }}</p>

    <article v-if="phase === 'setup'" class="panel stack">
      <h3>Innstillinger</h3>
      <label>
        Antall spørsmål
        <input v-model.number="settingsDraft.questionCount" type="number" min="1" max="10" />
      </label>
      <label>Tenk (sek) <input v-model.number="settingsDraft.thinkSeconds" type="number" min="5" max="180" /></label>
      <label>Svar (sek) <input v-model.number="settingsDraft.answerSeconds" type="number" min="15" max="600" /></label>
      <label>
        Bedrift
        <input v-model="companyName" type="text" maxlength="200" placeholder="F.eks. McKinsey" />
      </label>
      <label>
        Rollebeskrivelse
        <textarea
          v-model="roleDescription"
          rows="4"
          maxlength="8000"
          placeholder="Lim inn eller skriv kort om rollen du søker."
        />
      </label>
      <label>
        Vurderingsmodell
        <select v-model="settingsDraft.ratingModel">
          <option v-for="model in researchModels" :key="model" :value="model">
            {{ researchModelLabels[model] }}
          </option>
        </select>
      </label>
      <p class="muted">
        Spørsmålene lages med KI ut fra bedrift og rolle, og holdes skjult til du trekker kortet.
        Vurderingsmodellen brukes bare i ekte runde.
      </p>
      <p v-if="generatingQuestions" class="field-hint">Lager spørsmål …</p>
      <div class="form-grid">
        <AppButton
          variant="ghost"
          :loading="generatingQuestions"
          :disabled="startBusy"
          @click="confirmSettings('practice')"
        >
          Øverunde
        </AppButton>
        <AppButton
          :loading="generatingQuestions"
          :disabled="startBusy"
          @click="confirmSettings('scored')"
        >
          Start ekte runde
        </AppButton>
      </div>
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
      <p>{{ completedCards.length }} av {{ roundQuestions.length }} fullført</p>
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
      <p v-if="rating" class="field-hint">Transkriberer og vurderer …</p>
      <template v-else-if="usesAi">
        <template v-if="transcript">
          <p><strong>Transkripsjon:</strong> {{ transcript }}</p>
          <p v-if="stats" class="field-hint">
            {{ stats.wordCount }} ord · {{ stats.wordsPerMinute }} wpm · fyllord {{ stats.fillerCount }}
          </p>
          <div v-if="ratingStatus === 'ok' && feedback" class="stack-tight">
            <h4>STAR-vurdering (sum {{ feedback.sum }})</h4>
            <p class="field-hint">Vurdert med {{ ratingModelLabel }}</p>
            <ul class="plain-list score-list">
              <li v-for="entry in scoreEntries" :key="entry.key">
                {{ entry.label }}: {{ entry.score }}/4
              </li>
            </ul>
            <p>{{ feedback.improvement }}</p>
          </div>
          <div v-else-if="ratingStatus === 'unavailable'" class="stack-tight">
            <p class="field-hint">KI-vurdering er ikke tilgjengelig akkurat nå.</p>
            <AppButton variant="ghost" :disabled="rating || saving" @click="retryRating">
              Prøv vurdering på nytt
            </AppButton>
          </div>
        </template>
        <div v-else class="stack-tight">
          <p class="field-hint">Transkribering feilet.</p>
          <AppButton
            v-if="retainedAudioBlob"
            variant="ghost"
            :disabled="rating || saving"
            @click="retryTranscription"
          >
            Prøv transkribering på nytt
          </AppButton>
        </div>
      </template>
      <p v-else class="field-hint">
        Øverunde: spørsmålene er laget med KI, men svaret blir ikke transkribert eller vurdert.
      </p>
      <div class="form-grid">
        <AppButton variant="ghost" :disabled="rating || saving" @click="retake">Ta på nytt</AppButton>
        <AppButton :loading="saving" :disabled="rating" @click="nextCard">Neste kort</AppButton>
      </div>
    </article>

    <article v-else-if="phase === 'done'" class="panel stack">
      <h3>Ferdig</h3>
      <p v-if="practiceMode === 'practice'">
        Øverunde fullført. Spørsmålene ble laget med KI; svaret ble ikke lagret eller vurdert.
      </p>
      <p v-else>
        Du har gjennomført runden. Opptak lagres lokalt (IndexedDB) og hvert kort er logget med
        transkripsjon og vurdering.
      </p>
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

.score-list {
  display: grid;
  gap: 0.25rem;
}
</style>
