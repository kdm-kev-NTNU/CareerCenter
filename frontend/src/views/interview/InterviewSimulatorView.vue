<script setup lang="ts">
import type {
  InterviewCasePublicDto,
  InterviewMessageDto,
  InterviewMode,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  VoiceSessionDto
} from "@careercenter/shared";
import { interviewModes } from "@careercenter/shared";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import MediaDeviceCheck from "../../components/interview/MediaDeviceCheck.vue";
import { useMediaStream } from "../../composables/useMediaStream.js";
import { connectRealtimeVoice } from "../../lib/voiceRealtime.js";
import AppButton from "../../components/ui/AppButton.vue";
import ChatMessage from "../../components/ui/ChatMessage.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const channel = ref<"text" | "voice">("text");
const mode = ref<InterviewMode>("behavioral_mock");
const settings = ref<InterviewSimulatorSettingsDto | null>(null);
const session = ref<InterviewSessionDto | null>(null);
const messages = ref<InterviewMessageDto[]>([]);
const draft = ref("");
const voiceDraft = ref("");
const voiceSession = ref<VoiceSessionDto | null>(null);
const voiceReady = ref(false);
const voiceDevices = ref<{ audioDeviceId?: string; videoDeviceId?: string }>({});
const cases = ref<InterviewCasePublicDto[]>([]);
const caseEntryId = ref("");
const { stream: voiceStream, acquire: acquireVoiceStream, release: releaseVoiceStream } = useMediaStream();
const loading = ref(false);
const error = ref<string | null>(null);
let stopRealtime: (() => void) | null = null;

const voiceDeviceCheckActive = () =>
  channel.value === "voice" && Boolean(session.value) && !session.value?.finishedAt;

async function syncVoiceStream() {
  if (!voiceDeviceCheckActive()) {
    releaseVoiceStream();
    return;
  }
  await acquireVoiceStream({
    needCamera: false,
    needMicrophone: true,
    audioDeviceId: voiceDevices.value.audioDeviceId
  });
}

watch([channel, session], () => {
  void syncVoiceStream();
});

async function loadSettings() {
  settings.value = await interviewPrepApi.simulatorSettings(mode.value);
  if (mode.value === "case_oral") {
    cases.value = await interviewPrepApi.cases({ approvalStatus: "approved" });
  }
}

onMounted(() => void loadSettings());

onBeforeUnmount(() => {
  stopRealtime?.();
  stopRealtime = null;
  releaseVoiceStream();
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
  stopRealtime?.();
  stopRealtime = null;
  try {
    await saveSettings();
    session.value = await interviewPrepApi.createSession({
      mode: mode.value,
      title: `${mode.value} sim`,
      caseEntryId: mode.value === "case_oral" && caseEntryId.value ? caseEntryId.value : undefined
    });
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

async function connectVoiceLive() {
  if (!voiceSession.value || voiceSession.value.mock || !voiceStream.value || !session.value) return;
  try {
    const connection = await connectRealtimeVoice({
      clientSecret: voiceSession.value.clientSecret,
      model: voiceSession.value.model,
      stream: voiceStream.value,
      onTranscript: (role, text) => {
        void interviewPrepApi.appendTranscript(session.value!.id, { role, content: text }).then((saved) => {
          messages.value.push(saved);
        });
      },
      onToolCall: (name) => {
        if (name === "end_interview") void finishSession();
      }
    });
    stopRealtime = connection.stop;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke koble til stemme.";
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
  try {
    session.value = await interviewPrepApi.finishSession(session.value.id);
    stopRealtime?.();
    stopRealtime = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke avslutte.";
  }
}

function onVoiceDevicesReady(devices: { audioDeviceId?: string; videoDeviceId?: string }) {
  voiceDevices.value = { ...devices };
  voiceReady.value = true;
  if (voiceDeviceCheckActive()) void syncVoiceStream();
}

function onVoiceDevicesChange(devices: { audioDeviceId?: string; videoDeviceId?: string }) {
  voiceDevices.value = { ...devices };
  if (voiceDeviceCheckActive()) void syncVoiceStream();
}

function onVoiceDevicesFailed(reason: string) {
  error.value = reason;
  voiceReady.value = false;
}

function chatRole(role: string): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function printEssentials() {
  window.print();
}
</script>

<template>
  <section class="stack">
    <PageHeader title="Intervjussimulator" lead="Øv PEI og case med tekst eller stemme." />

    <article class="panel stack no-print">
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
      <label v-if="mode === 'case_oral'">
        Case
        <select v-model="caseEntryId">
          <option value="">Ingen valgt</option>
          <option v-for="item in cases" :key="item.id" :value="item.id">{{ item.title }}</option>
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
        <div class="form-grid">
          <AppButton variant="secondary" @click="saveSettings">Lagre innstillinger</AppButton>
          <AppButton variant="ghost" @click="printEssentials">Skriv ut essentials</AppButton>
        </div>
      </template>
      <AppButton :loading="loading" @click="startSession">Start ny sesjon</AppButton>
    </article>

    <article v-if="settings?.essentialsSheet" class="panel essentials-print-only">
      <h3>Essentials</h3>
      <pre>{{ settings.essentialsSheet }}</pre>
    </article>

    <MediaDeviceCheck
      v-if="channel === 'voice' && session && !session.finishedAt"
      class="no-print"
      :stream="voiceStream"
      :need-camera="false"
      @ready="onVoiceDevicesReady"
      @change="onVoiceDevicesChange"
      @failed="onVoiceDevicesFailed"
    />

    <article v-if="session && channel === 'voice' && voiceSession" class="panel stack no-print">
      <h3>Stemme-sesjon</h3>
      <p class="field-hint">
        Modell {{ voiceSession.model }} · {{ voiceSession.mock ? "mock" : "live" }} · utløper
        {{ new Date(voiceSession.expiresAt).toLocaleTimeString("nb-NO") }}
      </p>
      <p v-if="!voiceReady" class="field-hint">Tillat mikrofon for å fortsette.</p>
      <template v-else>
        <AppButton v-if="!voiceSession.mock" @click="connectVoiceLive">Koble til live stemme</AppButton>
        <p v-else class="field-hint">Mock: skriv det som «ble sagt» og lagre som transkripsjon.</p>
        <textarea v-model="voiceDraft" rows="2" placeholder="Transkripsjonslinje …" />
        <div class="form-grid">
          <AppButton @click="appendVoiceLine('user')">Lagre som deg</AppButton>
          <AppButton variant="ghost" @click="appendVoiceLine('assistant')">Lagre som intervjuer</AppButton>
        </div>
      </template>
    </article>

    <article v-if="session" class="panel stack no-print">
      <h3>Samtale</h3>
      <div class="stack">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :role="chatRole(message.role)"
          :content="message.content"
        />
      </div>
      <form v-if="channel === 'text'" class="stack" @submit.prevent="sendMessage">
        <textarea v-model="draft" rows="3" placeholder="Ditt svar …" />
        <AppButton type="submit" :loading="loading">Send</AppButton>
      </form>
      <AppButton variant="secondary" :disabled="!!session.finishedAt" @click="finishSession">
        Avslutt og hent feedback
      </AppButton>
      <div v-if="session.feedback" class="panel">
        <h4>Feedback (sum {{ session.feedback.sum }})</h4>
        <p>{{ session.feedback.improvement }}</p>
      </div>
    </article>

    <StateView v-if="error" state="error" :message="error" />
  </section>
</template>

<style scoped>
.essentials-print-only {
  display: none;
}
@media print {
  .no-print {
    display: none !important;
  }
  .essentials-print-only {
    display: block;
  }
  pre {
    white-space: pre-wrap;
    font-family: inherit;
  }
}
</style>
