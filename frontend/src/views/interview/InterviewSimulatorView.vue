<script setup lang="ts">
import type {
  InterviewCasePublicDto,
  InterviewMessageDto,
  InterviewMode,
  InterviewPrepPlanDto,
  InterviewSessionDto,
  InterviewSimulatorSettingsDto,
  PlanSectionKey,
  VoiceSessionDto
} from "@careercenter/shared";
import { buildPlanSections, canStartSimulators, interviewModes, planSectionLabels } from "@careercenter/shared";
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
/** null practises the whole interview; a key practises one section of the plan. */
const selectedSection = ref<PlanSectionKey | null>(null);
const planSessions = ref<InterviewSessionDto[]>([]);
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
/**
 * Shared stop handle. connectFreshVoice writes it from another function, so a
 * `let` would stay narrowed to null in startSession's catch.
 */
const voiceConnection: { stop: (() => void) | null } = { stop: null };
/** Ephemeral secrets are single-use; block overlapping connects. */
let connectVoiceInFlight = false;

function stopVoiceConnection() {
  const stop = voiceConnection.stop;
  voiceConnection.stop = null;
  stop?.();
}

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

const planSections = computed(() => (prepPlan.value ? buildPlanSections(prepPlan.value.questions) : []));
/** Latest finished session per section; "full" is the whole interview. */
const sectionResults = computed(() => {
  const latest = new Map<PlanSectionKey | "full", InterviewSessionDto>();
  for (const item of planSessions.value) {
    if (!item.finishedAt) continue;
    const key = item.planSection ?? "full";
    const current = latest.get(key);
    if (!current || item.finishedAt > (current.finishedAt ?? "")) latest.set(key, item);
  }
  return latest;
});
const practisedSectionCount = computed(
  () => planSections.value.filter((item) => sectionResults.value.has(item.key)).length
);
const startLabel = computed(() => {
  if (voiceLive.value) return "Opptak pågår";
  return selectedSection.value ? `Start: ${planSectionLabels[selectedSection.value]}` : "Start opptak";
});

function sectionMeta(key: PlanSectionKey | "full", fallback: string): string {
  const sum = sectionResults.value.get(key)?.feedback?.sum;
  return sum === undefined ? fallback : `${fallback} · sum ${sum}`;
}

function selectSection(key: PlanSectionKey | null) {
  if (voiceLive.value || loading.value) return;
  selectedSection.value = key;
}

async function loadPlanSessions(planId: string) {
  try {
    planSessions.value = await interviewPrepApi.sessions({ prepPlanId: planId });
  } catch {
    // Section progress is a hint; the simulator still works without it.
    planSessions.value = [];
  }
}

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
  selectedSection.value = null;
  planSessions.value = [];
  if (!routePlanId.value) {
    prepPlan.value = null;
    return;
  }
  void loadPlanSessions(routePlanId.value);
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
  stopVoiceConnection();
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
    voiceConnection.stop = connection.stop;
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
  stopVoiceConnection();
  releaseVoiceStream();
  try {
    await saveSettings();
    const sectionKey = prepPlan.value ? (selectedSection.value ?? undefined) : undefined;
    const sectionSuffix = sectionKey ? ` – ${planSectionLabels[sectionKey]}` : "";
    session.value = await interviewPrepApi.createSession({
      mode: mode.value,
      title: prepPlan.value ? `Øving: ${prepPlan.value.companyName}${sectionSuffix}` : `${mode.value} sim`,
      prepPlanId: routePlanId.value,
      planSection: sectionKey,
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
    stopVoiceConnection();
  } finally {
    loading.value = false;
  }
}

async function finishSession() {
  if (!session.value || finishing.value) return;
  finishing.value = true;
  error.value = null;
  // Tear down media first — finishSession API waits on LLM feedback and must not keep the call open.
  stopVoiceConnection();
  voiceLive.value = false;
  releaseVoiceStream();
  try {
    const finished = await interviewPrepApi.finishSession(session.value.id);
    session.value = finished;
    if (finished.prepPlanId && finished.prepPlanId === routePlanId.value) {
      planSessions.value = [finished, ...planSessions.value.filter((item) => item.id !== finished.id)];
    }
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
      <div v-if="planSections.length" class="stack-tight" data-test="plan-sections">
        <p class="field-hint">
          Øv hele intervjuet, eller én seksjon om gangen.
          {{ practisedSectionCount }} av {{ planSections.length }} seksjoner øvd.
        </p>
        <ul class="section-grid plain-list">
          <li>
            <button
              type="button"
              class="section-card section-card--full"
              :class="{
                'section-card--selected': selectedSection === null,
                'section-card--done': sectionResults.has('full')
              }"
              :aria-pressed="selectedSection === null"
              :disabled="voiceLive || loading"
              data-test="section-card-full"
              @click="selectSection(null)"
            >
              <span v-if="sectionResults.has('full')" class="section-card__mark" aria-hidden="true">✓</span>
              <span class="section-card__label">Hele intervjuet</span>
              <span class="section-card__meta">{{ sectionMeta("full", "Alle seksjoner") }}</span>
            </button>
          </li>
          <li v-for="item in planSections" :key="item.key">
            <button
              type="button"
              class="section-card"
              :class="{
                'section-card--selected': selectedSection === item.key,
                'section-card--done': sectionResults.has(item.key)
              }"
              :aria-pressed="selectedSection === item.key"
              :disabled="voiceLive || loading"
              :data-test="`section-card-${item.key}`"
              @click="selectSection(item.key)"
            >
              <span v-if="sectionResults.has(item.key)" class="section-card__mark" aria-hidden="true">✓</span>
              <span class="section-card__label">{{ item.title }}</span>
              <span class="section-card__meta">{{ sectionMeta(item.key, `${item.questionCount} spørsmål`) }}</span>
            </button>
          </li>
        </ul>
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
          {{ startLabel }}
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

<style scoped>
.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem;
}

.section-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  min-height: 6.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 2px solid #2a5078;
  background: linear-gradient(145deg, #1a3a5c, #0f2740);
  color: #e8f0fa;
  cursor: pointer;
  font: inherit;
  text-align: center;
}

.section-card--full {
  background: linear-gradient(145deg, #23476e, #14304d);
}

.section-card--done {
  border-color: var(--border);
  background: var(--surface-strong);
  color: inherit;
}

.section-card--selected {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.section-card:disabled {
  cursor: default;
  opacity: 0.65;
}

.section-card__mark {
  position: absolute;
  top: 0.4rem;
  right: 0.55rem;
  font-size: 1.1rem;
}

.section-card__label {
  font-weight: 600;
}

.section-card__meta {
  font-size: 0.85rem;
  opacity: 0.85;
}
</style>
