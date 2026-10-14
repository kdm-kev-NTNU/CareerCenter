<script setup lang="ts">
import type { InterviewBankQuestionDto, InterviewPrepPlanCaseDto, InterviewPrepPlanDto } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import StatusBadge from "../../components/listing/StatusBadge.vue";
import { toneForPrepPlanStatus } from "../../components/interview/statusTone.js";
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

const planId = computed(() => route.params.id as string);
const statusTone = computed(() => (plan.value ? toneForPrepPlanStatus(plan.value.status) : null));
const questionsByCategory = computed(() => {
  const groups = new Map<string, NonNullable<typeof plan.value>["questions"]>();
  for (const q of plan.value?.questions ?? []) {
    const list = groups.get(q.category) ?? [];
    list.push(q);
    groups.set(q.category, list);
  }
  return [...groups.entries()];
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const detail = await interviewPrepApi.plan(planId.value);
    plan.value = detail.plan;
    rankedCases.value = detail.rankedCases.length ? detail.rankedCases : detail.plan.recommendedCases;
    for (const item of detail.plan.clarifications) {
      answers.value[item.id] = item.answer;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente plan.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());

async function submitAnswers(skip = false) {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    plan.value = await interviewPrepApi.submitClarifications(
      plan.value.id,
      plan.value.clarifications.map((item) => ({ id: item.id, answer: answers.value[item.id] ?? "" })),
      skip
    );
    rankedCases.value = plan.value.recommendedCases;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke sende svar.";
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
    <StateView v-else-if="error" state="error" :message="error" />
    <template v-else-if="plan">
      <PageHeader :title="plan.companyName" :lead="plan.roleTitle || 'Rolle ikke spesifisert'">
        <template #meta>
          <StatusBadge v-if="statusTone" :label="statusTone.label" :variant="statusTone.variant" />
        </template>
      </PageHeader>

      <StateView
        v-if="plan.status === 'researching' || plan.status === 'curating'"
        state="loading"
        :message="plan.status === 'researching' ? 'Researcher bedrift og rolle …' : 'Velger spørsmål fra banken …'"
      />

      <article v-if="plan.researchNotes" class="panel">
        <h3>Research</h3>
        <p>{{ plan.researchNotes }}</p>
        <p v-if="plan.companyProfile?.summary" class="field-hint">{{ plan.companyProfile.summary }}</p>
      </article>

      <article v-if="plan.status === 'awaiting_answers'" class="panel stack">
        <h3>Oppklaring om bedrift og rolle (runde {{ plan.clarificationRound }})</h3>
        <p class="field-hint">Dette er ikke intervjuspørsmål — svarene styrer hvilke spørsmål og cases som velges fra banken.</p>
        <label v-for="item in plan.clarifications" :key="item.id">
          {{ item.question }}
          <textarea v-model="answers[item.id]" rows="2" />
        </label>
        <div class="form-grid">
          <AppButton :loading="saving" @click="submitAnswers(false)">
            {{ saving ? "Kurerer …" : "Send svar" }}
          </AppButton>
          <AppButton variant="secondary" :disabled="saving" @click="submitAnswers(true)">Hopp over runden</AppButton>
        </div>
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
