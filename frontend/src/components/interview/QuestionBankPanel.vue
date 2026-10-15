<script setup lang="ts">
import {
  questionAudienceLabels,
  questionAudiences,
  questionCategories,
  questionCategoryLabels,
  questionDiscardReasonLabels,
  type InterviewBankQuestionDto,
  type InterviewBankQuestionSummaryDto,
  type InterviewImportJobDto,
  type InterviewKnowledgeDocDto,
  type QuestionAudience,
  type QuestionCategory
} from "@careercenter/shared";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import AppButton from "../ui/AppButton.vue";
import StateView from "../ui/StateView.vue";

type Segment = QuestionAudience | "discarded";

const props = defineProps<{
  docs: InterviewKnowledgeDocDto[];
  jobs: InterviewImportJobDto[];
  aiConfigured: boolean;
}>();

const emit = defineEmits<{
  "jobs-changed": [];
}>();

const segment = ref<Segment>("candidate");
const searchQ = ref("");
const category = ref<QuestionCategory | "">("");
const questions = ref<InterviewBankQuestionDto[]>([]);
const summary = ref<InterviewBankQuestionSummaryDto | null>(null);
const loading = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const message = ref<string | null>(null);
const editingId = ref<string | null>(null);
const draft = reactive<{ text: string; audience: QuestionAudience; category: QuestionCategory }>({
  text: "",
  audience: "candidate",
  category: "behavioral"
});

const segments = computed(() => [
  ...questionAudiences.map((audience) => ({
    id: audience as Segment,
    label: questionAudienceLabels[audience],
    count: summary.value?.byAudience[audience]
  })),
  { id: "discarded" as Segment, label: "Forkastet", count: summary.value?.discarded }
]);

const activeCleanupJobs = computed(() =>
  props.jobs.filter(
    (job) => job.kind === "questions_cleanup" && (job.status === "queued" || job.status === "running")
  )
);

function docLabel(knowledgeDocId: string): string {
  const doc = props.docs.find((item) => item.id === knowledgeDocId);
  return doc?.sourceFilename || doc?.title || "";
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const q = searchQ.value.trim() || undefined;
    const params =
      segment.value === "discarded"
        ? { q, status: "discarded" as const }
        : { q, audience: segment.value, category: segment.value === "candidate" ? category.value || undefined : undefined };
    [questions.value, summary.value] = await Promise.all([
      interviewPrepApi.searchQuestions(params),
      interviewPrepApi.questionSummary()
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste spørsmålene.";
  } finally {
    loading.value = false;
  }
}

async function run(action: () => Promise<void>, fallback: string) {
  busy.value = true;
  error.value = null;
  try {
    await action();
  } catch (err) {
    error.value = err instanceof Error ? err.message : fallback;
  } finally {
    busy.value = false;
  }
}

function selectSegment(next: Segment) {
  segment.value = next;
  category.value = "";
  editingId.value = null;
  void load();
}

function selectCategory(next: QuestionCategory | "") {
  category.value = next;
  void load();
}

async function cleanup(reset: boolean) {
  if (reset && !confirm("Rydde alle spørsmål på nytt med KI? Spørsmål du har redigert selv blir ikke rørt.")) return;
  await run(async () => {
    const result = await interviewPrepApi.cleanupQuestions(reset);
    message.value = result.message;
    emit("jobs-changed");
    await load();
  }, "Kunne ikke starte oppryddingen.");
}

async function reindex() {
  await run(async () => {
    const result = await interviewPrepApi.reindexQuestions();
    message.value = result.message;
    emit("jobs-changed");
    await load();
  }, "Reindeksering feilet.");
}

function startEdit(question: InterviewBankQuestionDto) {
  editingId.value = question.id;
  draft.text = question.text;
  draft.audience = question.audience;
  draft.category = question.category;
}

async function saveEdit(question: InterviewBankQuestionDto) {
  await run(async () => {
    await interviewPrepApi.updateQuestion(question.id, {
      text: draft.text.trim() !== question.text ? draft.text.trim() : undefined,
      audience: draft.audience,
      category: draft.category
    });
    editingId.value = null;
    await load();
  }, "Kunne ikke lagre spørsmålet.");
}

async function discard(question: InterviewBankQuestionDto) {
  await run(async () => {
    await interviewPrepApi.discardQuestion(question.id);
    await load();
  }, "Kunne ikke forkaste spørsmålet.");
}

async function restore(question: InterviewBankQuestionDto) {
  await run(async () => {
    await interviewPrepApi.restoreQuestion(question.id);
    await load();
  }, "Kunne ikke gjenopprette spørsmålet.");
}

// Reload when the cleanup agent has finished all queued work.
watch(
  () => activeCleanupJobs.value.length,
  (now, before) => {
    if (before > 0 && now === 0) void load();
  }
);

onMounted(load);
</script>

<template>
  <article class="panel stack question-bank">
    <h3>Spørsmålsbank</h3>
    <div class="form-grid">
      <AppButton
        v-for="item in segments"
        :key="item.id"
        :variant="segment === item.id ? 'primary' : 'secondary'"
        @click="selectSegment(item.id)"
      >
        {{ item.label }}<template v-if="item.count !== undefined"> ({{ item.count }})</template>
      </AppButton>
    </div>

    <div v-if="segment === 'candidate'" class="chip-group" aria-label="Kategori">
      <AppButton class="mini-btn" :variant="category === '' ? 'primary' : 'secondary'" @click="selectCategory('')">
        Alle
      </AppButton>
      <AppButton
        v-for="item in questionCategories"
        :key="item"
        class="mini-btn"
        :variant="category === item ? 'primary' : 'secondary'"
        @click="selectCategory(item)"
      >
        {{ questionCategoryLabels[item] }}
      </AppButton>
    </div>

    <label>Søk <input v-model="searchQ" placeholder="f.eks. tilbakemelding, KI" @keyup.enter="load" /></label>
    <div class="form-grid">
      <AppButton :loading="loading" @click="load">Søk</AppButton>
      <AppButton variant="secondary" :disabled="busy" @click="reindex">Reindekser spørsmål</AppButton>
      <AppButton variant="secondary" :disabled="busy || !aiConfigured" @click="cleanup(false)">
        Rydd spørsmål med KI
      </AppButton>
      <AppButton variant="ghost" :disabled="busy || !aiConfigured" @click="cleanup(true)">Rydd alle på nytt</AppButton>
    </div>
    <p v-if="!aiConfigured" class="field-hint">KI er ikke konfigurert, så oppryddingen er slått av.</p>
    <p v-else-if="summary && summary.uncleaned > 0 && !activeCleanupJobs.length" class="field-hint">
      {{ summary.uncleaned }} spørsmål venter på KI-opprydding.
    </p>
    <ul v-if="activeCleanupJobs.length" class="plain-list">
      <li v-for="job in activeCleanupJobs" :key="job.id" class="field-hint">
        Rydder: {{ docLabel(job.knowledgeDocId) || "Dokument" }} · {{ job.progress }}% · {{ job.message }}
      </li>
    </ul>
    <p v-if="message" class="field-hint">{{ message }}</p>
    <StateView v-if="error" state="error" :message="error" />

    <StateView v-if="!loading && !questions.length" state="empty" message="Ingen spørsmål her." />
    <ul v-else class="plain-list">
      <li v-for="question in questions" :key="question.id" class="stack">
        <template v-if="editingId === question.id">
          <textarea v-model="draft.text" rows="2" aria-label="Spørsmålstekst" />
          <div class="form-grid">
            <label>
              Hvem spør
              <select v-model="draft.audience">
                <option v-for="audience in questionAudiences" :key="audience" :value="audience">
                  {{ questionAudienceLabels[audience] }}
                </option>
              </select>
            </label>
            <label v-if="draft.audience === 'candidate'">
              Kategori
              <select v-model="draft.category">
                <option v-for="item in questionCategories" :key="item" :value="item">
                  {{ questionCategoryLabels[item] }}
                </option>
              </select>
            </label>
          </div>
          <div class="form-grid">
            <AppButton :disabled="busy || draft.text.trim().length < 3" @click="saveEdit(question)">Lagre</AppButton>
            <AppButton variant="ghost" @click="editingId = null">Avbryt</AppButton>
          </div>
        </template>
        <template v-else>
          <strong>{{ question.text }}</strong>
          <span class="field-hint">
            <template v-if="segment === 'discarded'">
              {{ question.discardReason ? questionDiscardReasonLabels[question.discardReason] : "Forkastet" }} ·
            </template>
            <template v-else-if="question.audience === 'candidate'">{{ questionCategoryLabels[question.category] }} · </template>
            {{ docLabel(question.knowledgeDocId) }}
            <template v-if="!question.cleanedAt"> · ikke ryddet ennå</template>
          </span>
          <details v-if="question.sourceText !== question.text">
            <summary class="field-hint">Opprinnelig tekst</summary>
            <p class="field-hint">{{ question.sourceText }}</p>
          </details>
          <div class="form-grid">
            <template v-if="segment === 'discarded'">
              <AppButton class="mini-btn" variant="secondary" :disabled="busy" @click="restore(question)">
                Gjenopprett
              </AppButton>
            </template>
            <template v-else>
              <AppButton class="mini-btn" variant="secondary" @click="startEdit(question)">Rediger</AppButton>
              <AppButton class="mini-btn" variant="ghost" :disabled="busy" @click="discard(question)">Forkast</AppButton>
            </template>
          </div>
        </template>
      </li>
    </ul>
  </article>
</template>

