<script setup lang="ts">
import type { InterviewPrepPlanDto, RankableCase } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";

const route = useRoute();
const plan = ref<InterviewPrepPlanDto | null>(null);
const rankedCases = ref<RankableCase[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const answers = ref<Record<string, string>>({});

const planId = computed(() => route.params.id as string);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const detail = await interviewPrepApi.plan(planId.value);
    plan.value = detail.plan;
    rankedCases.value = detail.rankedCases;
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

async function submitAnswers() {
  if (!plan.value) return;
  saving.value = true;
  error.value = null;
  try {
    plan.value = await interviewPrepApi.submitClarifications(
      plan.value.id,
      plan.value.clarifications.map((item) => ({ id: item.id, answer: answers.value[item.id] ?? "" }))
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke sende svar.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="stack">
    <p v-if="loading">Laster plan …</p>
    <p v-else-if="error">{{ error }}</p>
    <template v-else-if="plan">
      <article class="panel strong">
        <h2>{{ plan.companyName }}</h2>
        <p>{{ plan.roleTitle || "Rolle ikke spesifisert" }} · Status: {{ plan.status }}</p>
      </article>

      <article v-if="plan.researchNotes" class="panel">
        <h3>Research</h3>
        <p>{{ plan.researchNotes }}</p>
      </article>

      <article v-if="plan.status === 'awaiting_answers'" class="panel stack">
        <h3>Avklaringer</h3>
        <label v-for="item in plan.clarifications" :key="item.id">
          {{ item.question }}
          <textarea v-model="answers[item.id]" rows="2" />
        </label>
        <button type="button" :disabled="saving" @click="submitAnswers">
          {{ saving ? "Kurerer …" : "Send svar og lag plan" }}
        </button>
      </article>

      <article v-if="plan.questions.length" class="panel stack">
        <h3>Spørsmål</h3>
        <ul class="plain-list">
          <li v-for="question in plan.questions" :key="question.id">
            {{ question.text }} <em>({{ question.category }})</em>
          </li>
        </ul>
      </article>

      <article v-if="plan.tasks.length" class="panel stack">
        <h3>Oppgaver</h3>
        <ul class="plain-list">
          <li v-for="task in plan.tasks" :key="task.id">{{ task.title }} — {{ task.description }}</li>
        </ul>
      </article>

      <article v-if="rankedCases.length" class="panel stack">
        <h3>Relevante case fra bibelen</h3>
        <ul class="plain-list">
          <li v-for="item in rankedCases.slice(0, 5)" :key="item.id">
            {{ item.id }} — {{ item.industry ?? "ukjent bransje" }} / {{ item.caseType ?? "case" }}
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
