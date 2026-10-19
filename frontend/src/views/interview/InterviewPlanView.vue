<script setup lang="ts">
import type {
  InterviewBankQuestionDto,
  InterviewPrepPlanDto,
  InterviewPrepQuestionDto,
  PrepPlanPipelineStep,
  QuestionCategory
} from "@careercenter/shared";
import {
  canCancelPrepPlan,
  canDeletePrepPlan,
  canStartSimulators,
  isPrepPlanPipelineActive,
  questionCategories,
  questionCategoryLabels,
  researchModelLabels
} from "@careercenter/shared";
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
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const answers = ref<Record<string, string>>({});
const swapQuestion = ref<InterviewPrepQuestionDto | null>(null);
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
const canDelete = computed(() => (plan.value ? canDeletePrepPlan(plan.value.status) : false));
const canPractice = computed(() => (plan.value ? canStartSimulators(plan.value.status) : false));
const canDownloadPractice = computed(
  () => plan.value?.status === "ready" && plan.value?.pipelineStep === "ready"
);
const downloadingPractice = ref(false);
const candidateQuestions = computed(
  () => plan.value?.questions.filter((q) => q.audience === "candidate") ?? []
);
const includedCount = computed(() => candidateQuestions.value.filter((q) => q.included).length);

/** Interviewer questions grouped by category. */
const questionGroups = computed(() => {
  const groups: Array<{ key: string; title: string; items: InterviewPrepQuestionDto[] }> = [];
  const byCategory = new Map<QuestionCategory, InterviewPrepQuestionDto[]>();
  for (const q of candidateQuestions.value) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }
  for (const [category, items] of byCategory) {
    groups.push({ key: category, title: questionCategoryLabels[category] ?? category, items });
  }
  return groups;
});

function applyDetail(detail: { plan: InterviewPrepPlanDto }) {
  plan.value = detail.plan;
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
    applyDetail({ plan: updated });
    followLive.value = true;
    ensurePolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke sende svar.";
  } finally {
    saving.value = false;
  }
}

async function resumeFromFailure() {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    const updated = await interviewPrepApi.resumePlan(plan.value.id);
    applyDetail({ plan: updated });
    followLive.value = true;
    ensurePolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke fortsette planen.";
  } finally {
    saving.value = false;
  }
}

async function retryResearch() {
  if (!plan.value) return;
  if (
    !confirm(
      "Starte research på nytt fra nett-søk? Ferdig research, svar og kuratering for denne planen erstattes."
    )
  ) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const updated = await interviewPrepApi.startPlanResearch(plan.value.id);
    applyDetail({ plan: updated });
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
    applyDetail({ plan: updated });
    stopPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke stoppe.";
  } finally {
    saving.value = false;
  }
}

async function deletePlan() {
  if (!plan.value) return;
  if (!confirm(`Slette planen for «${plan.value.companyName}»? Spørsmål og svar slettes. Øvingsøktene blir liggende.`)) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    await interviewPrepApi.deletePlan(plan.value.id);
    stopPolling();
    await router.push({ name: "interview-plans" });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke slette planen.";
  } finally {
    saving.value = false;
  }
}

async function openSwap(question: InterviewPrepQuestionDto) {
  swapQuestion.value = question;
  await searchSwap();
}

async function searchSwap() {
  if (!swapQuestion.value) return;
  bankHits.value = await interviewPrepApi.searchQuestions({
    q: bankQ.value || undefined,
    audience: "candidate"
  });
}

async function applySwap(bankQuestionId: string) {
  if (!plan.value || !swapQuestion.value) return;
  plan.value = await interviewPrepApi.replacePlanQuestion(plan.value.id, swapQuestion.value.id, {
    bankQuestionId
  });
  swapQuestion.value = null;
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

/** Swap with the neighbour in the same group; the backend needs the full list of ids. */
async function moveQuestion(question: InterviewPrepQuestionDto, direction: -1 | 1) {
  if (!plan.value) return;
  const ordered = [...plan.value.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const peers = ordered.filter((q) => q.audience === question.audience);
  const neighbour = peers[peers.findIndex((q) => q.id === question.id) + direction];
  if (!neighbour) return;
  const ids = ordered.map((q) => q.id);
  const from = ids.indexOf(question.id);
  const to = ids.indexOf(neighbour.id);
  ids[from] = neighbour.id;
  ids[to] = question.id;
  plan.value = await interviewPrepApi.reorderPlanQuestions(plan.value.id, ids);
}

function practiceWithPlan() {
  if (!plan.value) return;
  void router.push({ name: "interview-simulator", query: { planId: plan.value.id } });
}

async function downloadPracticeDocx() {
  if (!plan.value) return;
  downloadingPractice.value = true;
  error.value = null;
  try {
    await interviewPrepApi.downloadPracticeDocx(plan.value.id, plan.value.companyName);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste ned øvingsdokument.";
  } finally {
    downloadingPractice.value = false;
  }
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
          <AppButton
            v-if="canDownloadPractice"
            variant="secondary"
            :loading="downloadingPractice"
            @click="downloadPracticeDocx"
          >
            Last ned øvingsdokument (Word)
          </AppButton>
          <AppButton v-if="canPractice" :disabled="includedCount === 0" @click="practiceWithPlan">
            Øv med denne planen
          </AppButton>
        </template>
      </PageHeader>

      <p class="muted-hint">
        Reasoning-modell: {{ researchModelLabels[plan.researchModel] ?? plan.researchModel }}
      </p>

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
            <p v-if="plan.jobAdText" class="field-hint">Stillingsannonse er limt inn ({{ plan.jobAdText.length }} tegn).</p>
            <p v-else class="field-hint">Ingen stillingsannonse limt inn.</p>
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
          <template v-else-if="selectedStep === 'drafting_answers'">
            <p v-if="plan.pipelineStep === 'drafting_answers'">
              Skriver eksempelsvar og tips til spørsmålene …
            </p>
            <p v-else>Eksempelsvar og tips er klare.</p>
          </template>
          <template v-else-if="selectedStep === 'clarifications'">
            <p v-if="plan.clarifications.length">
              {{ plan.clarifications.length }} spørsmål er klare. Gå til «Dine svar» for å svare.
            </p>
            <p v-else>Lager oppklaringsspørsmål om hull i research …</p>
          </template>
          <template v-else-if="selectedStep === 'awaiting_answers'">
            <p class="field-hint">
              Runde {{ plan.clarificationRound }}. Dette er ikke intervjuspørsmål — svarene styrer hvilke spørsmål
              som velges fra banken.
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
            <p v-if="plan.curationFilledCount > 0" class="field-hint">
              Modellen valgte for få; {{ plan.curationFilledCount }} ble fylt inn fra rangeringen.
            </p>
          </template>
          <template v-else>
            <p>Planen har {{ plan.questions.length }} spørsmål klar for øving.</p>
          </template>
        </div>
        <div class="form-grid">
          <AppButton v-if="canCancel" variant="secondary" :loading="saving" @click="stopResearch">Stopp</AppButton>
          <AppButton
            v-if="plan.status === 'failed' || plan.status === 'cancelled'"
            :loading="saving"
            @click="resumeFromFailure"
          >
            Fortsett fra steget som feilet
          </AppButton>
          <AppButton
            v-if="plan.status === 'failed' || plan.status === 'cancelled'"
            variant="secondary"
            :loading="saving"
            @click="retryResearch"
          >
            Start på nytt
          </AppButton>
          <AppButton v-if="canDelete" variant="ghost" :loading="saving" @click="deletePlan">Slett plan</AppButton>
        </div>
      </article>

      <article v-if="plan.repeatedStoryIds.length" class="panel">
        <p class="error-text">Advarsel: samme historie er brukt mer enn én gang i planen.</p>
      </article>

      <article v-if="plan.questions.length || canPractice" class="panel stack">
        <div class="panel-heading-row">
          <h3>Spørsmål ({{ includedCount }}/{{ candidateQuestions.length }} i øving)</h3>
          <AppButton v-if="canPractice" variant="secondary" :disabled="includedCount === 0" @click="practiceWithPlan">
            Øv med denne planen
          </AppButton>
        </div>
        <template v-for="group in questionGroups" :key="group.key">
          <div class="stack">
          <h4>{{ group.title }}</h4>
          <ul class="plain-list">
            <li v-for="question in group.items" :key="question.id" class="stack">
              <div class="panel-heading-row">
                <label class="inline-check">
                  <input type="checkbox" :checked="question.included" @change="toggleIncluded(question)" />
                  Ta med i øving
                </label>
                <div class="form-grid">
                  <AppButton variant="ghost" class="mini-btn" @click="moveQuestion(question, -1)">Opp</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="moveQuestion(question, 1)">Ned</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="startEdit(question)">Rediger</AppButton>
                  <AppButton variant="ghost" class="mini-btn" @click="openSwap(question)">Bytt</AppButton>
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
                <div v-if="question.exampleAnswer" class="stack">
                  <details>
                    <summary class="field-hint">Eksempelsvar og tips</summary>
                    <p class="plan-step-prose">{{ question.exampleAnswer }}</p>
                    <ul v-if="question.tips?.length" class="plain-list">
                      <li v-for="(tip, ti) in question.tips" :key="ti" class="field-hint">💡 {{ tip }}</li>
                    </ul>
                  </details>
                </div>
              </template>
            </li>
          </ul>
          </div>
        </template>

        <div class="stack">
          <h4>Legg til spørsmål</h4>
          <textarea v-model="newQuestionText" rows="2" placeholder="Skriv et spørsmål …" />
          <label>
            Kategori
            <select v-model="newQuestionCategory">
              <option v-for="item in questionCategories" :key="item" :value="item">
                {{ questionCategoryLabels[item] }}
              </option>
            </select>
          </label>
          <AppButton :loading="saving" :disabled="!newQuestionText.trim()" @click="addQuestion">Legg til</AppButton>
        </div>
      </article>

      <article v-if="swapQuestion" class="panel stack">
        <h3>Bytt med spørsmål fra banken</h3>
        <label>
          Søk
          <input v-model="bankQ" @keyup.enter="searchSwap" />
        </label>
        <AppButton variant="secondary" @click="searchSwap">Søk</AppButton>
        <ul class="plain-list">
          <li v-for="hit in bankHits" :key="hit.id" class="panel-heading-row">
            <span>{{ hit.text }}</span>
            <AppButton class="mini-btn" @click="applySwap(hit.id)">Velg</AppButton>
          </li>
        </ul>
        <AppButton variant="ghost" @click="swapQuestion = null">Lukk</AppButton>
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
