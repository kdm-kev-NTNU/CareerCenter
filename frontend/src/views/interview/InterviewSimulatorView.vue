<script setup lang="ts">
import type {
  InterviewMessageDto,
  InterviewMode,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  VoiceSessionDto
} from "@careercenter/shared";
import { interviewModes } from "@careercenter/shared";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import MediaDeviceCheck from "../../components/interview/MediaDeviceCheck.vue";

const channel = ref<"text" | "voice">("text");
const mode = ref<InterviewMode>("behavioral_mock");
const settings = ref<InterviewSimulatorSettingsDto | null>(null);
const session = ref<InterviewSessionDto | null>(null);
const messages = ref<InterviewMessageDto[]>([]);
const draft = ref("");
const voiceDraft = ref("");
const voiceSession = ref<VoiceSessionDto | null>(null);
const voiceReady = ref(false);
const deviceCheck = ref<InstanceType<typeof MediaDeviceCheck> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadSettings() {
  settings.value = await interviewPrepApi.simulatorSettings(mode.value);
}

onMounted(() => void loadSettings());

onBeforeUnmount(() => {
  deviceCheck.value?.releaseTracks();
});

async function saveSettings() {
  if (!settings.value) return;
  settings.value = await interviewPrepApi.saveSimulatorSettings(settings.value);
}

async function startSession() {
  loading.value = true;
  error.value = null;
  voiceSession.value = null;
  voiceReady.value = false;
  try {
    await saveSettings();
    session.value = await interviewPrepApi.createSession({ mode: mode.value, title: `${mode.value} sim` });
    messages.value = (await interviewPrepApi.sessionMessages(session.value.id)).filter((m) => m.role !== "system");
    if (channel.value === "voice") {
      voiceSession.value = await interviewPrepApi.createVoiceSession();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke starte sesjon.";
  } finally {
    loading.value = false;
  }
}

async function sendMessage() {
  if (!session.value || !draft.value.trim()) return;
  loading.value = true;
  try {
    const userText = draft.value.trim();
    draft.value = "";
    messages.value.push({ id: `local-${Date.now()}`, role: "user", content: userText, createdAt: new Date().toISOString() });
    const assistant = await interviewPrepApi.sendSessionMessage(session.value.id, userText);
    messages.value.push(assistant);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Melding feilet.";
  } finally {
    loading.value = false;
  }
}

async function appendVoiceLine(role: "user" | "assistant") {
  if (!session.value || !voiceDraft.value.trim()) return;
  const content = voiceDraft.value.trim();
  voiceDraft.value = "";
  const saved = await interviewPrepApi.appendTranscript(session.value.id, { role, content });
  messages.value.push(saved);
}

async function finishSession() {
  if (!session.value) return;
  session.value = await interviewPrepApi.finishSession(session.value.id);
}

function onVoiceDevicesReady() {
  voiceReady.value = true;
}

function onVoiceDevicesFailed(reason: string) {
  error.value = reason;
  voiceReady.value = false;
}
</script>

<template>
  <section class="stack">
    <article class="panel strong">
      <h2>Intervjusimulator</h2>
      <p>Tekstchat eller stemme-stub med enhetssjekk og transkripsjon lagret som meldinger.</p>
    </article>

    <article class="panel stack">
      <div class="toolbar">
        <button type="button" :class="{ active: channel === 'text' }" @click="channel = 'text'">Tekst</button>
        <button type="button" :class="{ active: channel === 'voice' }" @click="channel = 'voice'">Stemme</button>
      </div>
      <label>
        Modus
        <select v-model="mode" @change="loadSettings">
          <option v-for="item in interviewModes" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <template v-if="settings">
        <label>Selskap <input v-model="settings.companyName" /></label>
        <label>Tone <input v-model="settings.tone" /></label>
        <label>Språk <input v-model="settings.language" /></label>
        <label>
          Essentials-ark
          <textarea v-model="settings.essentialsSheet" rows="4" placeholder="Nøkkelpunkter til intervjueren …" />
        </label>
        <button type="button" class="secondary" @click="saveSettings">Lagre innstillinger</button>
      </template>
      <button type="button" :disabled="loading" @click="startSession">Start ny sesjon</button>
    </article>

    <MediaDeviceCheck
      v-if="channel === 'voice' && session && !session.finishedAt"
      ref="deviceCheck"
      :need-camera="false"
      @ready="onVoiceDevicesReady"
      @failed="onVoiceDevicesFailed"
    />

    <article v-if="session && channel === 'voice' && voiceSession" class="panel stack">
      <h3>Stemme-sesjon</h3>
      <p class="field-hint">
        Modell {{ voiceSession.model }} · {{ voiceSession.mock ? "mock" : "live" }} · utløper
        {{ new Date(voiceSession.expiresAt).toLocaleTimeString("nb-NO") }}
      </p>
      <p v-if="!voiceReady">Tillat mikrofon for å fortsette.</p>
      <template v-else>
        <p class="field-hint">Stub: skriv det som «ble sagt» og lagre som transkripsjon.</p>
        <textarea v-model="voiceDraft" rows="2" placeholder="Transkripsjonslinje …" />
        <div class="form-grid">
          <button type="button" @click="appendVoiceLine('user')">Lagre som deg</button>
          <button type="button" class="ghost" @click="appendVoiceLine('assistant')">Lagre som intervjuer</button>
        </div>
      </template>
    </article>

    <article v-if="session" class="panel stack">
      <h3>Samtale</h3>
      <ul class="plain-list">
        <li v-for="message in messages" :key="message.id">
          <strong>{{ message.role }}:</strong> {{ message.content }}
        </li>
      </ul>
      <form v-if="channel === 'text'" class="stack" @submit.prevent="sendMessage">
        <textarea v-model="draft" rows="3" placeholder="Ditt svar …" />
        <button type="submit" :disabled="loading">Send</button>
      </form>
      <button type="button" class="secondary" :disabled="!!session.finishedAt" @click="finishSession">
        Avslutt og hent feedback
      </button>
      <div v-if="session.feedback" class="panel">
        <h4>Feedback (sum {{ session.feedback.sum }})</h4>
        <p>{{ session.feedback.improvement }}</p>
      </div>
    </article>

    <p v-if="error">{{ error }}</p>
  </section>
</template>
