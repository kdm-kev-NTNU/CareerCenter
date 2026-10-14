<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    needCamera?: boolean;
    needMicrophone?: boolean;
  }>(),
  { needCamera: true, needMicrophone: true }
);

const emit = defineEmits<{
  ready: [devices: { audioDeviceId?: string; videoDeviceId?: string }];
  failed: [reason: string];
}>();

const error = ref<string | null>(null);
const audioDevices = ref<MediaDeviceInfo[]>([]);
const videoDevices = ref<MediaDeviceInfo[]>([]);
const audioDeviceId = ref("");
const videoDeviceId = ref("");
const stream = ref<MediaStream | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const micLevel = ref(0);

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;

function releaseTracks() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  stream.value?.getTracks().forEach((t) => t.stop());
  stream.value = null;
  void audioCtx?.close();
  audioCtx = null;
  analyser = null;
}

async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  audioDevices.value = devices.filter((d) => d.kind === "audioinput");
  videoDevices.value = devices.filter((d) => d.kind === "videoinput");
  if (!audioDeviceId.value && audioDevices.value[0]) audioDeviceId.value = audioDevices.value[0].deviceId;
  if (!videoDeviceId.value && videoDevices.value[0]) videoDeviceId.value = videoDevices.value[0].deviceId;
}

async function startPreview() {
  error.value = null;
  releaseTracks();

  if (!window.isSecureContext && location.hostname !== "localhost") {
    error.value = "Kamera/mikrofon krever HTTPS (eller localhost).";
    emit("failed", error.value);
    return;
  }

  try {
    const constraints: MediaStreamConstraints = {};
    if (props.needMicrophone) {
      constraints.audio = audioDeviceId.value ? { deviceId: { exact: audioDeviceId.value } } : true;
    }
    if (props.needCamera) {
      constraints.video = videoDeviceId.value ? { deviceId: { exact: videoDeviceId.value } } : true;
    }
    const media = await navigator.mediaDevices.getUserMedia(constraints);
    stream.value = media;
    await listDevices();
    if (videoEl.value && props.needCamera) {
      videoEl.value.srcObject = media;
      await videoEl.value.play().catch(() => undefined);
    }
    if (props.needMicrophone) {
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
    emit("ready", {
      audioDeviceId: audioDeviceId.value || undefined,
      videoDeviceId: videoDeviceId.value || undefined
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "Error";
    if (name === "NotAllowedError") {
      error.value = "Tilgang nektet. Tillat kamera/mikrofon i nettleseren.";
    } else if (name === "NotFoundError") {
      error.value = "Fant ingen kamera- eller mikrofonenhet.";
    } else if (name === "NotReadableError") {
      error.value = "Enheten er opptatt av en annen app.";
    } else {
      error.value = "Kunne ikke starte kamera/mikrofon.";
    }
    emit("failed", error.value);
  }
}

watch([audioDeviceId, videoDeviceId], () => {
  void startPreview();
});

onMounted(() => {
  void startPreview();
});

onBeforeUnmount(() => {
  releaseTracks();
});

defineExpose({ releaseTracks, startPreview });
</script>

<template>
  <div class="panel stack media-device-check">
    <h2>Enhetssjekk</h2>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div v-if="needCamera" class="preview">
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
    <button type="button" class="ghost" @click="startPreview">Prøv igjen</button>
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
