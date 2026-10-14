<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    stream?: MediaStream | null;
    needCamera?: boolean;
    needMicrophone?: boolean;
  }>(),
  { stream: null, needCamera: true, needMicrophone: true }
);

const emit = defineEmits<{
  ready: [devices: { audioDeviceId?: string; videoDeviceId?: string }];
  change: [devices: { audioDeviceId?: string; videoDeviceId?: string }];
  failed: [reason: string];
}>();

const error = ref<string | null>(null);
const audioDevices = ref<MediaDeviceInfo[]>([]);
const videoDevices = ref<MediaDeviceInfo[]>([]);
const audioDeviceId = ref("");
const videoDeviceId = ref("");
const videoEl = ref<HTMLVideoElement | null>(null);
const micLevel = ref(0);
const didEmitReady = ref(false);

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;

function stopMicMeter() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  void audioCtx?.close();
  audioCtx = null;
  analyser = null;
  micLevel.value = 0;
}

function devicePayload() {
  return {
    audioDeviceId: audioDeviceId.value || undefined,
    videoDeviceId: videoDeviceId.value || undefined
  };
}

function emitSelection(kind: "ready" | "change") {
  const payload = devicePayload();
  if (kind === "ready") {
    if (didEmitReady.value) return;
    didEmitReady.value = true;
    emit("ready", payload);
  } else {
    emit("change", payload);
  }
}

async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  audioDevices.value = devices.filter((d) => d.kind === "audioinput");
  videoDevices.value = devices.filter((d) => d.kind === "videoinput");
  if (!audioDeviceId.value && audioDevices.value[0]) audioDeviceId.value = audioDevices.value[0].deviceId;
  if (!videoDeviceId.value && videoDevices.value[0]) videoDeviceId.value = videoDevices.value[0].deviceId;
}

async function refreshDevices() {
  error.value = null;
  if (!window.isSecureContext && location.hostname !== "localhost") {
    error.value = "Kamera/mikrofon krever HTTPS (eller localhost).";
    emit("failed", error.value);
    return;
  }
  try {
    await listDevices();
    emitSelection("ready");
  } catch {
    error.value = "Kunne ikke liste enheter.";
    emit("failed", error.value);
  }
}

function attachPreview(media: MediaStream | null) {
  if (!videoEl.value || !props.needCamera) return;
  videoEl.value.srcObject = media;
  if (media) {
    void videoEl.value.play().catch(() => undefined);
  }
}

function startMicMeter(media: MediaStream | null) {
  stopMicMeter();
  if (!media || !props.needMicrophone) return;
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(media);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!analyser) return;
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    micLevel.value = Math.min(100, Math.round((avg / 128) * 100));
    raf = requestAnimationFrame(tick);
  };
  tick();
}

watch(
  () => props.stream,
  (media) => {
    attachPreview(media ?? null);
    startMicMeter(media ?? null);
  },
  { immediate: true }
);

watch([audioDeviceId, videoDeviceId], () => {
  if (!didEmitReady.value) return;
  emitSelection("change");
});

onMounted(() => {
  void refreshDevices();
});

onBeforeUnmount(() => {
  stopMicMeter();
});
</script>

<template>
  <div class="panel stack media-device-check">
    <h2>Enhetssjekk</h2>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-if="needCamera" class="preview self-view">
      <video ref="videoEl" playsinline muted autoplay />
    </div>
    <label v-if="needMicrophone">
      Mikrofon
      <select v-model="audioDeviceId">
        <option v-for="d in audioDevices" :key="d.deviceId" :value="d.deviceId">
          {{ d.label || "Mikrofon" }}
        </option>
      </select>
      <div class="mic-meter" aria-hidden="true">
        <span :style="{ width: micLevel + '%' }" />
      </div>
    </label>
    <label v-if="needCamera">
      Kamera
      <select v-model="videoDeviceId">
        <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
          {{ d.label || "Kamera" }}
        </option>
      </select>
    </label>
    <button type="button" class="ghost" @click="refreshDevices">Prøv igjen</button>
  </div>
</template>

<style scoped>
.preview {
  width: min(320px, 100%);
  aspect-ratio: 16 / 9;
  background: var(--surface-strong);
  border-radius: 8px;
  overflow: hidden;
}
.preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mic-meter {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  margin-top: 6px;
  overflow: hidden;
}
.mic-meter span {
  display: block;
  height: 100%;
  background: var(--accent);
}
</style>
