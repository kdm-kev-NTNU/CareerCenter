<script setup lang="ts">
import type {
  InterviewBankQuestionDto,
  InterviewPrepPlanCaseDto,
  InterviewPrepPlanDto,
  InterviewPrepQuestionDto,
  PrepPlanPipelineStep,
  QuestionCategory
} from "@careercenter/shared";
import { canCancelPrepPlan, canStartSimulators, isPrepPlanPipelineActive } from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import StatusBadge from "../../components/listing/StatusBadge.vue";
import PrepPlanStepper from "../../components/interview/PrepPlanStepper.vue";
import { prepPlanPipelineStepLabel, toneForPrepPlanStatus } from "../../components/interview/statusTone.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const route = useRoute();
const router = useRouter();
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
const editingId = ref<string | null>(null);
const editText = ref("");
const editNotes = ref("");
const newQuestionText = ref("");
const newQuestionCategory = ref<QuestionCategory>("behavioral");
let pollTimer: ReturnType<typeof setInterval> | undefined;

const planId = computed(() => route.params.id as string);
const statusTone = computed(() => (plan.value ? toneForPrepPlanStatus(plan.value.status) : null));
const pipelineActive = computed(() =>
  plan.value ? isPrepPlanPipelineActive(plan.value.pipelineStep, plan.value.status) : false
);
const canCancel = computed(() => (plan.value ? canCancelPrepPlan(plan.value.status) : false));
const canPractice = computed(() => (plan.value ? canStartSimulators(plan.value.status) : false));
const includedCount = computed(
  () => plan.value?.questions.filter((q) => q.included).length ?? 0
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

async function stopResearch() {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = await interviewPrepApi.cancelPlan(plan.value.id);
    applyDetail({ plan: updated, rankedCases: updated.recommendedCases });
    stopPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke stoppe.";
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

function startEdit(question: InterviewPrepQuestionDto) {
  editingId.value = question.id;
  editText.value = question.text;
  editNotes.value = question.notes;
}

async function saveEdit() {
  if (!plan.value || !editingId.value) return;
  saving.value = true;
  try {
    plan.value = await interviewPrepApi.patchPlanQuestion(plan.value.id, editingId.value, {
      text: editText.value.trim(),
      notes: editNotes.value
    });
    editingId.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke lagre spørsmål.";
  } finally {
    saving.value = false;
  }
}

async function toggleIncluded(question: InterviewPrepQuestionDto) {
  if (!plan.value) return;
  plan.value = await interviewPrepApi.patchPlanQuestion(plan.value.id, question.id, {
    included: !question.included
  });
}

async function removeQuestion(questionId: string) {
  if (!plan.value) return;
  plan.value = await interviewPrepApi.deletePlanQuestion(plan.value.id, questionId);
}

async function addQuestion() {
  if (!plan.value || !newQuestionText.value.trim()) return;
  saving.value = true;
  try {
    plan.value = await interviewPrepApi.addPlanQuestion(plan.value.id, {
      text: newQuestionText.value.trim(),
      category: newQuestionCategory.value
    });
    newQuestionText.value = "";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke legge til spørsmål.";
  } finally {
    saving.value = false;
  }
}

async function moveQuestion(questionId: string, direction: -1 | 1) {
  if (!plan.value) return;
  const ordered = [...plan.value.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((q) => q.id === questionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return;
  const ids = ordered.map((q) => q.id);
  const tmp = ids[index]!;
  ids[index] = ids[target]!;
  ids[target] = tmp;
  plan.value = await interviewPrepApi.reorderPlanQuestions(plan.value.id, ids);
}

function practiceWithPlan() {
  if (!plan.value) return;
  void router.push({ name: "interview-simulator", query: { planId: plan.value.id } });
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
        <template #actions>
          <AppButton v-if="canPractice" :disabled="includedCount === 0" @click="practiceWithPlan">
            Øv med denne planen
          </AppButton>
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
          <p v-if="(plan.status === 'failed' || plan.status === 'cancelled') && plan.failureReason" class="error-text">
            {{ plan.failureReason }}
          </p>

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
        <div class="form-grid">
          <AppButton v-if="canCancel" variant="secondary" :loading="saving" @click="stopResearch">Stopp</AppButton>
          <AppButton
            v-if="plan.status === 'failed' || plan.status === 'cancelled'"
            :loading="saving"
            @click="retryResearch"
          >
            Start på nytt
          </AppButton>
        </div>
      </article>

      <article v-if="plan.repeatedStoryIds.length" class="panel">
        <p class="error-text">Advarsel: samme historie er brukt mer enn én gang i planen.</p>
      </article>

      <article v-if="plan.questions.length || canPractice" class="panel stack">
        <div class="panel-heading-row">
          <h3>Spørsmål ({{ includedCount }}/{{ plan.questions.length }} i øving)</h3>
          <AppButton v-if="canPractice" variant="secondary" :disabled="includedCount === 0" @click="practiceWithPlan">
            Øv med denne planen
          </AppButton>
        </div>
        <div v-for="[category, items] in questionsByCategory" :key="category" class="stack">
          <h4>{{ category }}</h4>
          <ul class="plain-list">
            <li v-for="question in items" :key="question.id" class="stack">
              <div class="panel-heading-row">
                <label class="inline-check">
                  <input type="checkbox" :checked="question.included" @change="toggleIncluded(question)" />
                  Ta med i øving
                </label>
                <div class="form-grid">
                  <AppButton variant="ghost" class="mini-btn" @click="moveQuestion(question.id, -1)">Opp</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="moveQuestion(question.id, 1)">Ned</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="startEdit(question)">Rediger</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="openSwap(question.id)">Bytt</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="removeQuestion(question.id)">Slett</AppButton>
                </div>
              </div>
              <template v-if="editingId === question.id">
                <textarea v-model="editText" rows="2" />
                <label>
                  Notater (til boten)
                  <textarea v-model="editNotes" rows="2" />
                </label>
                <div class="form-grid">
                  <AppButton :loading="saving" @click="saveEdit">Lagre</AppButton>
                  <AppButton variant="ghost" @click="editingId = null">Avbryt</AppButton>
                </div>
              </template>
              <template v-else>
                <p :class="{ 'field-hint': !question.included }">{{ question.text }}</p>
                <span class="field-hint">
                  {{ question.source === "bank" ? "fra bank" : question.source === "custom" ? "egendefinert" : question.source === "edited" ? "redigert" : "generert" }}
                  <template v-if="question.gapReason"> — {{ question.gapReason }}</template>
                  <template v-if="question.notes"> — notater: {{ question.notes }}</template>
                </span>
              </template>
            </li>
          </ul>
        </div>

        <div class="stack">
          <h4>Legg til spørsmål</h4>
          <textarea v-model="newQuestionText" rows="2" placeholder="Skriv et intervjuspørsmål …" />
          <label>
            Kategori
            <select v-model="newQuestionCategory">
              <option value="behavioral">behavioral</option>
              <option value="technical">technical</option>
              <option value="motivation">motivation</option>
              <option value="company">company</option>
              <option value="case">case</option>
            </select>
          </label>
          <AppButton :loading="saving" :disabled="!newQuestionText.trim()" @click="addQuestion">Legg til</AppButton>
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

<style scoped>
.inline-check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
</style>
