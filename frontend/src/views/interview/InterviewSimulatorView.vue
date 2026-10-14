<script setup lang="ts">
import type { InterviewMessageDto, InterviewMode, InterviewSessionDto, InterviewSimulatorSettingsDto } from "@careercenter/shared";
import { interviewModes } from "@careercenter/shared";
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";

const mode = ref<InterviewMode>("behavioral_mock");
const settings = ref<InterviewSimulatorSettingsDto | null>(null);
const session = ref<InterviewSessionDto | null>(null);
const messages = ref<InterviewMessageDto[]>([]);
const draft = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

async function loadSettings() {
  settings.value = await interviewPrepApi.simulatorSettings(mode.value);
}

onMounted(() => void loadSettings());

async function saveSettings() {
  if (!settings.value) return;
  settings.value = await interviewPrepApi.saveSimulatorSettings(settings.value);
}

async function startSession() {
  loading.value = true;
  error.value = null;
  try {
    await saveSettings();
    session.value = await interviewPrepApi.createSession({ mode: mode.value, title: `${mode.value} sim` });
    messages.value = (await interviewPrepApi.sessionMessages(session.value.id)).filter((m) => m.role !== "system");
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

async function finishSession() {
  if (!session.value) return;
  session.value = await interviewPrepApi.finishSession(session.value.id);
}
</script>

<template>
  <section class="stack">
    <article class="panel strong">
      <h2>Intervjusimulator</h2>
      <p>Innstillinger, chat og STAR-feedback.</p>
    </article>

    <article class="panel stack">
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

    <article v-if="session" class="panel stack">
      <h3>Chat</h3>
      <ul class="plain-list">
        <li v-for="message in messages" :key="message.id">
          <strong>{{ message.role }}:</strong> {{ message.content }}
        </li>
      </ul>
      <form class="stack" @submit.prevent="sendMessage">
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
