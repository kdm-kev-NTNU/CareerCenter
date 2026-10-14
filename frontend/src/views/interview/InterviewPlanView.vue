<script setup lang="ts">
import type {
  InterviewBankQuestionDto,
  InterviewPrepPlanCaseDto,
  InterviewPrepPlanDto,
  PrepPlanPipelineStep
} from "@careercenter/shared";
import { isPrepPlanPipelineActive } from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import StatusBadge from "../../components/listing/StatusBadge.vue";
import PrepPlanStepper from "../../components/interview/PrepPlanStepper.vue";
import { prepPlanPipelineStepLabel, toneForPrepPlanStatus } from "../../components/interview/statusTone.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const route = useRoute();
const plan = ref<InterviewPrepPlanDto | null>(null);
const rankedCases = ref<InterviewPrepPlanCaseDto[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const answers = ref<Record<string, string>>({});
const swapQuestionId = ref<string | null>(null);
const bankHits = ref<InterviewBankQuestionDto[]>([]);
const bankQ = ref("");
const selectedStep = ref<PrepPlanPipelineStep>("created");
const followLive = ref(true);
let pollTimer: ReturnType<typeof setInterval> | undefined;

const planId = computed(() => route.params.id as string);
const statusTone = computed(() => (plan.value ? toneForPrepPlanStatus(plan.value.status) : null));
const pipelineActive = computed(() =>
  plan.value ? isPrepPlanPipelineActive(plan.value.pipelineStep, plan.value.status) : false
);
const questionsByCategory = computed(() => {
  const groups = new Map<string, NonNullable<typeof plan.value>["questions"]>();
  for (const q of plan.value?.questions ?? []) {
    const list = groups.get(q.category) ?? [];
    list.push(q);
    groups.set(q.category, list);
  }
  return [...groups.entries()];
});

function applyDetail(detail: { plan: InterviewPrepPlanDto; rankedCases: InterviewPrepPlanCaseDto[] }) {
  plan.value = detail.plan;
  rankedCases.value = detail.rankedCases.length ? detail.rankedCases : detail.plan.recommendedCases;
  for (const item of detail.plan.clarifications) {
    if (answers.value[item.id] === undefined || item.answer) {
      answers.value[item.id] = item.answer;
    }
  }
  if (followLive.value) selectedStep.value = detail.plan.pipelineStep;
}

async function load() {
  loading.value = true;
  error.value = null;
  plan.value = null;
  try {
    applyDetail(await interviewPrepApi.plan(planId.value));
    ensurePolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente plan.";
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  try {
    applyDetail(await interviewPrepApi.plan(planId.value));
    if (!pipelineActive.value) stopPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente plan.";
    stopPolling();
  }
}

function stopPolling() {
  if (pollTimer === undefined) return;
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function ensurePolling() {
  if (pollTimer !== undefined || !pipelineActive.value) return;
  pollTimer = setInterval(() => void refresh(), 1500);
}

function chooseStep(step: PrepPlanPipelineStep) {
  selectedStep.value = step;
  followLive.value = plan.value ? step === plan.value.pipelineStep : false;
}

function followActiveStep() {
  if (!plan.value) return;
  followLive.value = true;
  selectedStep.value = plan.value.pipelineStep;
}

onMounted(() => void load());
onUnmounted(() => stopPolling());
watch(planId, () => {
  stopPolling();
  followLive.value = true;
  void load();
});

async function submitAnswers(skip = false) {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = await interviewPrepApi.submitClarifications(
      plan.value.id,
      plan.value.clarifications.map((item) => ({ id: item.id, answer: answers.value[item.id] ?? "" })),
      skip
    );
    applyDetail({ plan: updated, rankedCases: updated.recommendedCases });
    followLive.value = true;
    ensurePolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke sende svar.";
  } finally {
    saving.value = false;
  }
}

async function retryResearch() {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = await interviewPrepApi.startPlanResearch(plan.value.id);
    applyDetail({ plan: updated, rankedCases: updated.recommendedCases });
    followLive.value = true;
    ensurePolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke starte research.";
  } finally {
    saving.value = false;
  }
}

async function openSwap(questionId: string) {
  swapQuestionId.value = questionId;
  bankHits.value = await interviewPrepApi.searchQuestions({ q: bankQ.value || undefined });
}

async function applySwap(bankQuestionId: string) {
  if (!plan.value || !swapQuestionId.value) return;
  plan.value = await interviewPrepApi.replacePlanQuestion(plan.value.id, swapQuestionId.value, {
    bankQuestionId
  });
  swapQuestionId.value = null;
}
</script>

<template>
  <section class="stack">
    <StateView v-if="loading" state="loading" message="Laster plan …" />
    <StateView v-else-if="error && !plan" state="error" :message="error" />
    <template v-else-if="plan">
      <p v-if="error" class="error-text">{{ error }}</p>
      <PageHeader :title="plan.companyName" :lead="plan.roleTitle || 'Rolle ikke spesifisert'">
        <template #meta>
          <StatusBadge v-if="statusTone" :label="statusTone.label" :variant="statusTone.variant" />
        </template>
      </PageHeader>

      <article class="panel stack">
        <div class="panel-heading-row">
          <h3>Steg</h3>
          <AppButton v-if="!followLive && pipelineActive" variant="ghost" class="mini-btn" @click="followActiveStep">
            Vis aktivt steg
          </AppButton>
        </div>
        <PrepPlanStepper :plan="plan" :selected="selectedStep" @select="chooseStep" />
        <div class="plan-step-detail" data-test="plan-step-detail" aria-live="polite">
          <h3>{{ prepPlanPipelineStepLabel[selectedStep] }}</h3>
          <p v-if="plan.status === 'failed' && plan.failureReason" class="error-text">{{ plan.failureReason }}</p>

          <template v-if="selectedStep === 'created'">
            <p>{{ plan.companyName }}<template v-if="plan.roleTitle"> — {{ plan.roleTitle }}</template></p>
          </template>
          <template v-else-if="selectedStep === 'searching'">
            <p>Søker etter intervju, kultur og rolle for {{ plan.companyName }}.</p>
          </template>
          <template v-else-if="selectedStep === 'research_notes'">
            <p v-if="plan.researchNotes" class="plan-step-prose">{{ plan.researchNotes }}</p>
            <p v-else>Skriver research-notater …</p>
          </template>
          <template v-else-if="selectedStep === 'company_profile'">
            <p v-if="plan.companyProfile?.summary">{{ plan.companyProfile.summary }}</p>
            <p v-else>Bygger bedriftsprofil …</p>
            <p v-if="plan.companyProfile?.industries.length" class="field-hint">
              Bransjer: {{ plan.companyProfile.industries.join(", ") }}
            </p>
            <p v-if="plan.companyProfile?.themes.length" class="field-hint">
              Temaer: {{ plan.companyProfile.themes.join(", ") }}
            </p>
          </template>
          <template v-else-if="selectedStep === 'clarifications'">
            <p v-if="plan.clarifications.length">
              {{ plan.clarifications.length }} spørsmål er klare. Gå til «Dine svar» for å svare.
            </p>
            <p v-else>Lager oppklaringsspørsmål om hull i research …</p>
          </template>
          <template v-else-if="selectedStep === 'awaiting_answers'">
            <p class="field-hint">
              Runde {{ plan.clarificationRound }}. Dette er ikke intervjuspørsmål — svarene styrer hvilke spørsmål og
              cases som velges fra banken.
            </p>
            <div v-if="plan.clarifications.length" class="stack">
              <label v-for="item in plan.clarifications" :key="item.id">
                {{ item.question }}
                <textarea v-model="answers[item.id]" rows="2" :disabled="plan.status !== 'awaiting_answers'" />
              </label>
              <div v-if="plan.status === 'awaiting_answers'" class="form-grid">
                <AppButton :loading="saving" @click="submitAnswers(false)">Send svar</AppButton>
                <AppButton variant="secondary" :disabled="saving" @click="submitAnswers(true)">Hopp over runden</AppButton>
              </div>
            </div>
            <p v-else>Venter på oppklaringsspørsmål …</p>
          </template>
          <template v-else-if="selectedStep === 'curating_questions'">
            <p>Velger {{ plan.questions.length || "30–50" }} spørsmål fra banken.</p>
          </template>
          <template v-else-if="selectedStep === 'curating_cases'">
            <p>Kobler case og øvingsoppgaver til profilen.</p>
          </template>
          <template v-else>
            <p>Planen har {{ plan.questions.length }} spørsmål og {{ rankedCases.length }} anbefalte case.</p>
          </template>
        </div>
        <AppButton v-if="plan.status === 'failed'" :loading="saving" @click="retryResearch">Start på nytt</AppButton>
      </article>

      <article v-if="plan.repeatedStoryIds.length" class="panel">
        <p class="error-text">Advarsel: samme historie er brukt mer enn én gang i planen.</p>
      </article>

      <article v-if="plan.questions.length" class="panel stack">
        <h3>Spørsmål ({{ plan.questions.length }})</h3>
        <div v-for="[category, items] in questionsByCategory" :key="category" class="stack">
          <h4>{{ category }}</h4>
          <ul class="plain-list">
            <li v-for="question in items" :key="question.id" class="panel-heading-row">
              <div>
                {{ question.text }}
                <span class="field-hint">
                  {{ question.source === "bank" ? "fra bank" : "generert" }}
                  <template v-if="question.gapReason"> — {{ question.gapReason }}</template>
                </span>
              </div>
              <AppButton variant="ghost" class="mini-btn" @click="openSwap(question.id)">Bytt</AppButton>
            </li>
          </ul>
        </div>
      </article>

      <article v-if="swapQuestionId" class="panel stack">
        <h3>Bytt med spørsmål fra banken</h3>
        <label>
          Søk
          <input v-model="bankQ" @keyup.enter="openSwap(swapQuestionId!)" />
        </label>
        <AppButton variant="secondary" @click="openSwap(swapQuestionId!)">Søk</AppButton>
        <ul class="plain-list">
          <li v-for="hit in bankHits" :key="hit.id" class="panel-heading-row">
            <span>{{ hit.text }}</span>
            <AppButton class="mini-btn" @click="applySwap(hit.id)">Velg</AppButton>
          </li>
        </ul>
        <AppButton variant="ghost" @click="swapQuestionId = null">Lukk</AppButton>
      </article>

      <article v-if="plan.tasks.length" class="panel stack">
        <h3>Oppgaver</h3>
        <ul class="plain-list">
          <li v-for="task in plan.tasks" :key="task.id">{{ task.title }} — {{ task.description }}</li>
        </ul>
      </article>

      <article v-if="rankedCases.length" class="panel stack">
        <h3>Anbefalte case</h3>
        <ul class="plain-list">
          <li v-for="item in rankedCases" :key="item.id">
            <strong>{{ item.title }}</strong>
            <p>{{ item.prompt.slice(0, 200) }}</p>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
