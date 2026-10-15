<script setup lang="ts">
import type {
  InterviewCasePublicDto,
  InterviewMessageDto,
  InterviewMode,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  VoiceSessionDto
} from "@careercenter/shared";
import { canStartSimulators, interviewModes } from "@careercenter/shared";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import { toneForPrepPlanStatus } from "../../components/interview/statusTone.js";
import EssentialsSheetEditor from "../../components/interview/EssentialsSheetEditor.vue";
import { useMediaStream } from "../../composables/useMediaStream.js";
import { printEssentialsSheet } from "../../lib/printEssentials.js";
import { connectRealtimeVoice } from "../../lib/voiceRealtime.js";
import AppButton from "../../components/ui/AppButton.vue";
import ChatMessage from "../../components/ui/ChatMessage.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const route = useRoute();
const router = useRouter();
const mode = ref<InterviewMode>("behavioral_mock");
const settings = ref<InterviewSimulatorSettingsDto | null>(null);
const session = ref<InterviewSessionDto | null>(null);
const messages = ref<InterviewMessageDto[]>([]);
const voiceLive = ref(false);
const cases = ref<InterviewCasePublicDto[]>([]);
const caseEntryId = ref("");
const prepPlan = ref<InterviewPrepPlanDto | null>(null);
const savedPlans = ref<InterviewPrepPlanDto[]>([]);
const {
  stream: voiceStream,
  acquire: acquireVoiceStream,
  release: releaseVoiceStream,
  error: mediaError
} = useMediaStream();
const loading = ref(false);
const finishing = ref(false);
const error = ref<string | null>(null);
const aiConfigured = ref(false);
let stopRealtime: (() => void) | null = null;
/** Ephemeral secrets are single-use; block overlapping connects. */
let connectVoiceInFlight = false;

const LAST_PLAN_KEY = "careercenter:simulator-plan";

function readLastPlanId(): string | null {
  try {
    return localStorage.getItem(LAST_PLAN_KEY);
  } catch {
    return null;
  }
}

function writeLastPlanId(planId: string | null) {
  try {
    if (planId) localStorage.setItem(LAST_PLAN_KEY, planId);
    else localStorage.removeItem(LAST_PLAN_KEY);
  } catch {
    // Remembering the plan is a convenience; the simulator works without it.
  }
}

const routePlanId = computed(() => {
  const value = route.query.planId;
  return typeof value === "string" && value ? value : undefined;
});
/** The URL owns the selected plan, so links from the plan list and reloads keep it. */
const selectedPlanId = computed({
  get: () => routePlanId.value ?? "",
  set: (planId: string) => {
    if (!planId) writeLastPlanId(null);
    void router.replace({ query: { ...route.query, planId: planId || undefined } });
  }
});
const planLabel = computed(() => {
  if (!prepPlan.value) return null;
  const count = prepPlan.value.questions.filter((q) => q.included && q.audience === "candidate").length;
  return `Plan: ${prepPlan.value.companyName} (${count} spørsmål)`;
});

async function loadSettings() {
  settings.value = await interviewPrepApi.simulatorSettings(mode.value);
  if (mode.value === "case_oral") {
    cases.value = await interviewPrepApi.cases({ approvalStatus: "approved" });
  }
}

function planOptionLabel(plan: InterviewPrepPlanDto): string {
  const name = plan.roleTitle ? `${plan.companyName} – ${plan.roleTitle}` : plan.companyName;
  return canStartSimulators(plan.status) ? name : `${name} (${toneForPrepPlanStatus(plan.status).label})`;
}

async function loadSavedPlans() {
  try {
    savedPlans.value = await interviewPrepApi.plans();
    // Coming back via the Simulator tab drops ?planId, so reopen the plan used last time.
    const lastPlanId = readLastPlanId();
    const lastPlan = savedPlans.value.find((plan) => plan.id === lastPlanId);
    if (!routePlanId.value && lastPlan && canStartSimulators(lastPlan.status)) {
      selectedPlanId.value = lastPlan.id;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente lagrede planer.";
  }
}

async function loadPlan() {
  if (!routePlanId.value) {
    prepPlan.value = null;
    return;
  }
  try {
    const detail = await interviewPrepApi.plan(routePlanId.value);
    prepPlan.value = detail.plan;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste plan.";
    prepPlan.value = null;
  }
}

onMounted(() => {
  void loadSettings();
  void loadSavedPlans();
  void interviewPrepApi
    .getStatus()
    .then((status) => {
      aiConfigured.value = status.aiConfigured;
    })
    .catch(() => {
      aiConfigured.value = false;
    });
});
watch(
  routePlanId,
  (planId) => {
    if (planId) writeLastPlanId(planId);
    void loadPlan();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopRealtime?.();
  stopRealtime = null;
  releaseVoiceStream();
});

async function saveSettings() {
  if (!settings.value) return;
  const { essentialsIsDefault, ...rest } = settings.value;
  // null keeps the default, so later improvements to the default sheet reach this user.
  settings.value = await interviewPrepApi.saveSimulatorSettings({
    ...rest,
    essentialsSheet: essentialsIsDefault ? null : rest.essentialsSheet
  });
}

function onEssentialsChange(sheet: string, isDefault: boolean) {
  if (!settings.value) return;
  settings.value = { ...settings.value, essentialsSheet: sheet, essentialsIsDefault: isDefault };
}

/** Mint immediately before /calls — ephemeral secrets are single-use. */
async function connectFreshVoice(sessionId: string, voice: VoiceSessionDto) {
  if (connectVoiceInFlight) return;
  connectVoiceInFlight = true;
  try {
    if (!voiceStream.value) throw new Error("Mikrofon er ikke klar.");
    const connection = await connectRealtimeVoice({
      clientSecret: voice.clientSecret,
      model: voice.model,
      stream: voiceStream.value,
      onTranscript: (role, text) => {
        void interviewPrepApi.appendTranscript(sessionId, { role, content: text }).then((saved) => {
          messages.value.push(saved);
        });
      },
      onToolCall: (name) => {
        if (name === "end_interview") void finishSession();
      }
    });
    stopRealtime = connection.stop;
    voiceLive.value = true;
  } finally {
    connectVoiceInFlight = false;
  }
}

async function startSession() {
  if (loading.value || connectVoiceInFlight) return;
  loading.value = true;
  error.value = null;
  voiceLive.value = false;
  stopRealtime?.();
  stopRealtime = null;
  releaseVoiceStream();
  try {
    await saveSettings();
    session.value = await interviewPrepApi.createSession({
      mode: mode.value,
      title: prepPlan.value ? `Øving: ${prepPlan.value.companyName}` : `${mode.value} sim`,
      prepPlanId: routePlanId.value,
      caseEntryId: mode.value === "case_oral" && caseEntryId.value ? caseEntryId.value : undefined
    });
    messages.value = (await interviewPrepApi.sessionMessages(session.value.id)).filter((m) => m.role !== "system");

    await acquireVoiceStream({ needCamera: false, needMicrophone: true });
    if (!voiceStream.value) {
      error.value = mediaError.value ?? "Tillat mikrofon for å starte opptak.";
      return;
    }

    // Mint immediately before connect so the secret cannot be reused or go stale in the UI.
    const voice = await interviewPrepApi.createVoiceSession(session.value.id);
    if (voice.mock) {
      error.value = "Stemme er ikke konfigurert (mock). Sett OPENAI_API_KEY for live intervju.";
      return;
    }

    await connectFreshVoice(session.value.id, voice);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke starte opptak.";
    voiceLive.value = false;
    stopRealtime?.();
    stopRealtime = null;
  } finally {
    loading.value = false;
  }
}

async function finishSession() {
  if (!session.value || finishing.value) return;
  finishing.value = true;
  error.value = null;
  // Tear down media first — finishSession API waits on LLM feedback and must not keep the call open.
  stopRealtime?.();
  stopRealtime = null;
  voiceLive.value = false;
  releaseVoiceStream();
  try {
    session.value = await interviewPrepApi.finishSession(session.value.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke avslutte.";
  } finally {
    finishing.value = false;
  }
}

function chatRole(role: string): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function printEssentials() {
  const sheet = settings.value?.essentialsSheet ?? "";
  if (!printEssentialsSheet(sheet)) {
    error.value = sheet.trim()
      ? "Tillat sprettoppvindu for å skrive ut essentials."
      : "Skriv noe i essentials-arket først.";
  }
}
</script>

<template>
  <section class="stack">
    <PageHeader title="Intervjussimulator" lead="Øv PEI og case med stemme." />
    <p v-if="planLabel" class="field-hint" data-test="plan-practice-label">{{ planLabel }}</p>

    <article class="panel stack">
      <label>
        Plan
        <select v-model="selectedPlanId" data-test="plan-select">
          <option value="">Ingen plan (generell øving)</option>
          <option
            v-for="plan in savedPlans"
            :key="plan.id"
            :value="plan.id"
            :disabled="!canStartSimulators(plan.status)"
          >
            {{ planOptionLabel(plan) }}
          </option>
        </select>
      </label>
      <p class="field-hint">
        Planene dine er lagret.
        <RouterLink v-if="routePlanId" :to="{ name: 'interview-plan', params: { id: routePlanId } }">Åpne valgt plan</RouterLink>
        <template v-if="routePlanId"> · </template>
        <RouterLink :to="{ name: 'interview-plans' }">Se alle planer</RouterLink>
      </p>
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
        <EssentialsSheetEditor
          :sheet="settings.essentialsSheet"
          :is-default="settings.essentialsIsDefault"
          :mode="mode"
          :ai-configured="aiConfigured"
          @change="onEssentialsChange"
        />
        <p class="field-hint">Skriv ut essentials åpner bare dette arket, ikke hele siden.</p>
        <div class="form-grid">
          <AppButton variant="secondary" @click="saveSettings">Lagre innstillinger</AppButton>
          <AppButton variant="ghost" @click="printEssentials">Skriv ut essentials</AppButton>
        </div>
      </template>
      <div class="form-grid">
        <AppButton
          data-test="start-recording"
          :loading="loading"
          :disabled="voiceLive"
          @click="startSession()"
        >
          {{ voiceLive ? "Opptak pågår" : "Start opptak" }}
        </AppButton>
      </div>
      <p v-if="voiceLive" class="field-hint" data-test="voice-live-hint">Live stemme er tilkoblet — intervjueren starter.</p>
    </article>

    <article v-if="session" class="panel stack">
      <h3>Samtale</h3>
      <div class="stack">
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :role="chatRole(message.role)"
          :content="message.content"
        />
      </div>
      <AppButton
        variant="secondary"
        :loading="finishing"
        :disabled="!!session.finishedAt || finishing"
        @click="finishSession"
      >
        {{ finishing ? "Henter feedback …" : "Avslutt og hent feedback" }}
      </AppButton>
      <div v-if="session.feedback" class="panel">
        <h4>Feedback (sum {{ session.feedback.sum }})</h4>
        <p>{{ session.feedback.improvement }}</p>
      </div>
    </article>

    <StateView v-if="error" state="error" :message="error" />
  </section>
</template>
