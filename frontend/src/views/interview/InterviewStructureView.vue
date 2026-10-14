<script setup lang="ts">
import {
  emptyStarScores,
  starRubricCriteria,
  starRubricCriterionLabels,
  type InterviewCaseRepertoireLogDto,
  type InterviewStoryBankEntryDto
} from "@careercenter/shared";
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import { requestBlob } from "../../api/client.js";
import AppModal from "../../components/listing/AppModal.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const tab = ref<"stories" | "repertoire">("stories");
const stories = ref<InterviewStoryBankEntryDto[]>([]);
const weakest = ref<InterviewStoryBankEntryDto[]>([]);
const logs = ref<InterviewCaseRepertoireLogDto[]>([]);
const editingId = ref<string | null>(null);
const form = ref({
  title: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  tags: "" as string
});
const scoreStoryId = ref<string | null>(null);
const scoreDraft = ref({ scores: emptyStarScores(), note: "" });
const logForm = ref({
  title: "",
  company: "",
  format: "",
  tested: "",
  improvement: "",
  outcome: "",
  notes: ""
});
const error = ref<string | null>(null);
const loading = ref(false);
const deleteConfirmId = ref<string | null>(null);

function resetForm() {
  editingId.value = null;
  form.value = { title: "", situation: "", task: "", action: "", result: "", tags: "" };
}

async function loadAll() {
  loading.value = true;
  error.value = null;
  try {
    [stories.value, weakest.value, logs.value] = await Promise.all([
      interviewPrepApi.stories(),
      interviewPrepApi.weakestStories(),
      interviewPrepApi.repertoireLogs()
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste struktur.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadAll());

function editStory(story: InterviewStoryBankEntryDto) {
  editingId.value = story.id;
  form.value = {
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    tags: story.tags.join(", ")
  };
}

async function saveStory() {
  const payload = {
    title: form.value.title.trim(),
    situation: form.value.situation,
    task: form.value.task,
    action: form.value.action,
    result: form.value.result,
    tags: form.value.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  };
  if (!payload.title) return;
  if (editingId.value) {
    await interviewPrepApi.updateStory(editingId.value, payload);
  } else {
    await interviewPrepApi.createStory(payload);
  }
  resetForm();
  await loadAll();
}

async function confirmRemoveStory() {
  if (!deleteConfirmId.value) return;
  await interviewPrepApi.deleteStory(deleteConfirmId.value);
  deleteConfirmId.value = null;
  await loadAll();
}

async function submitScore() {
  if (!scoreStoryId.value) return;
  await interviewPrepApi.addStoryScore(scoreStoryId.value, {
    scores: scoreDraft.value.scores,
    note: scoreDraft.value.note
  });
  scoreStoryId.value = null;
  scoreDraft.value = { scores: emptyStarScores(), note: "" };
  await loadAll();
}

async function addLog() {
  if (!logForm.value.title.trim() || !logForm.value.improvement.trim()) return;
  await interviewPrepApi.createRepertoireLog({
    title: logForm.value.title.trim(),
    company: logForm.value.company,
    format: logForm.value.format,
    tested: logForm.value.tested,
    improvement: logForm.value.improvement,
    outcome: logForm.value.outcome,
    notes: logForm.value.notes
  });
  logForm.value = {
    title: "",
    company: "",
    format: "",
    tested: "",
    improvement: "",
    outcome: "",
    notes: ""
  };
  await loadAll();
}

async function downloadAnki() {
  const blob = await requestBlob(interviewPrepApi.ankiExportUrl());
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "interview-mecca-star.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Historiebank"
      lead="STAR-historier merket til spørsmålstyper, svakeste først og Anki-eksport."
    >
      <template #actions>
        <div class="toolbar">
          <button type="button" :class="{ active: tab === 'stories' }" @click="tab = 'stories'">Historiebank</button>
          <button type="button" :class="{ active: tab === 'repertoire' }" @click="tab = 'repertoire'">Case-logg</button>
        </div>
      </template>
    </PageHeader>

    <StateView v-if="error" state="error" :message="error" />
    <StateView v-if="loading" state="loading" />

    <template v-if="tab === 'stories' && !loading">
      <article class="panel stack">
        <div class="toolbar">
          <AppButton variant="ghost" @click="resetForm">Ny historie</AppButton>
          <AppButton variant="secondary" @click="downloadAnki">Eksporter Anki CSV</AppButton>
        </div>
        <label>Tittel <input v-model="form.title" /></label>
        <label>Situasjon <textarea v-model="form.situation" rows="2" /></label>
        <label>Oppgave <textarea v-model="form.task" rows="2" /></label>
        <label>Handling <textarea v-model="form.action" rows="2" /></label>
        <label>Resultat <textarea v-model="form.result" rows="2" /></label>
        <label>Tagger (kommaseparert) <input v-model="form.tags" /></label>
        <AppButton @click="saveStory">{{ editingId ? "Oppdater" : "Lagre" }}</AppButton>
      </article>

      <article class="panel stack">
        <h3>Svakeste kø</h3>
        <StateView v-if="!weakest.length" state="empty" message="Ingen historier ennå." />
        <ul v-else class="plain-list">
          <li v-for="story in weakest" :key="story.id" class="panel-heading-row">
            <div>
              <strong>{{ story.title }}</strong>
              <span class="field-hint">snitt {{ story.averageSum ?? "—" }}</span>
            </div>
            <div class="page-header-actions">
              <AppButton variant="ghost" class="mini-btn" @click="scoreStoryId = story.id">Score</AppButton>
              <AppButton variant="ghost" class="mini-btn" @click="editStory(story)">Rediger</AppButton>
              <AppButton variant="ghost" class="mini-btn" @click="deleteConfirmId = story.id">Slett</AppButton>
            </div>
          </li>
        </ul>
      </article>
    </template>

    <template v-else-if="!loading">
      <article class="panel stack">
        <h3>Logg case-øving</h3>
        <label>Tittel <input v-model="logForm.title" /></label>
        <label>Selskap <input v-model="logForm.company" /></label>
        <label>Format <input v-model="logForm.format" placeholder="f.eks. interviewer-led" /></label>
        <label>Hva ble testet <input v-model="logForm.tested" /></label>
        <label>Ett forbedringspunkt <input v-model="logForm.improvement" required /></label>
        <label>Utfall <input v-model="logForm.outcome" placeholder="f.eks. solid struktur" /></label>
        <label>Notater <textarea v-model="logForm.notes" rows="3" /></label>
        <AppButton @click="addLog">Lagre logg</AppButton>
      </article>
      <article class="panel stack">
        <h3>Repertoire</h3>
        <StateView v-if="!logs.length" state="empty" message="Ingen logger ennå." />
        <ul v-else class="plain-list">
          <li v-for="log in logs" :key="log.id">
            <strong>{{ log.title }}</strong> — {{ log.company }} / {{ log.format }}
            <p class="field-hint">Testet: {{ log.tested }} · Forbedring: {{ log.improvement }}</p>
            <p class="field-hint">{{ log.outcome }} — {{ log.notes }}</p>
          </li>
        </ul>
      </article>
    </template>

    <AppModal
      :open="!!scoreStoryId"
      title="Score historie"
      @close="scoreStoryId = null"
    >
      <form class="stack" @submit.prevent="submitScore">
        <label v-for="key in starRubricCriteria" :key="key">
          {{ starRubricCriterionLabels[key] }}
          <input v-model.number="scoreDraft.scores[key]" type="number" min="1" max="5" />
        </label>
        <label>Notat <input v-model="scoreDraft.note" /></label>
        <div class="page-header-actions">
          <AppButton type="submit">Lagre score</AppButton>
          <AppButton variant="secondary" type="button" @click="scoreStoryId = null">Avbryt</AppButton>
        </div>
      </form>
    </AppModal>

    <AppModal
      :open="!!deleteConfirmId"
      title="Slett historie"
      @close="deleteConfirmId = null"
    >
      <p>Er du sikker på at du vil slette denne historien?</p>
      <div class="page-header-actions">
        <AppButton @click="confirmRemoveStory">Slett</AppButton>
        <AppButton variant="secondary" @click="deleteConfirmId = null">Avbryt</AppButton>
      </div>
    </AppModal>
  </section>
</template>
