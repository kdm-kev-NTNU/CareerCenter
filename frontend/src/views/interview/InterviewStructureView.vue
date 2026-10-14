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
const logForm = ref({ title: "", outcome: "", notes: "" });
const error = ref<string | null>(null);
const loading = ref(false);

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

async function removeStory(id: string) {
  await interviewPrepApi.deleteStory(id);
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
  if (!logForm.value.title.trim()) return;
  await interviewPrepApi.createRepertoireLog({
    title: logForm.value.title.trim(),
    outcome: logForm.value.outcome,
    notes: logForm.value.notes
  });
  logForm.value = { title: "", outcome: "", notes: "" };
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
    <header class="panel strong">
      <h2>Struktur</h2>
      <p>STAR-historiebank, svakeste først, case-repertoire og Anki-eksport.</p>
      <div class="toolbar">
        <button type="button" :class="{ active: tab === 'stories' }" @click="tab = 'stories'">Historiebank</button>
        <button type="button" :class="{ active: tab === 'repertoire' }" @click="tab = 'repertoire'">Case-logg</button>
      </div>
    </header>

    <p v-if="error">{{ error }}</p>
    <p v-if="loading">Laster …</p>

    <template v-if="tab === 'stories'">
      <article class="panel stack">
        <div class="toolbar">
          <button type="button" class="ghost" @click="resetForm">Ny historie</button>
          <button type="button" class="secondary" @click="downloadAnki">Eksporter Anki CSV</button>
        </div>
        <label>Tittel <input v-model="form.title" /></label>
        <label>Situasjon <textarea v-model="form.situation" rows="2" /></label>
        <label>Oppgave <textarea v-model="form.task" rows="2" /></label>
        <label>Handling <textarea v-model="form.action" rows="2" /></label>
        <label>Resultat <textarea v-model="form.result" rows="2" /></label>
        <label>Tagger (kommaseparert) <input v-model="form.tags" /></label>
        <button type="button" @click="saveStory">{{ editingId ? "Oppdater" : "Lagre" }}</button>
      </article>

      <article class="panel stack">
        <h3>Svakeste kø</h3>
        <ul class="plain-list">
          <li v-for="story in weakest" :key="story.id">
            {{ story.title }}
            <span class="field-hint">snitt {{ story.averageSum ?? "—" }}</span>
            <button type="button" class="ghost" @click="scoreStoryId = story.id">Score</button>
            <button type="button" class="ghost" @click="editStory(story)">Rediger</button>
            <button type="button" class="ghost" @click="removeStory(story.id)">Slett</button>
          </li>
        </ul>
      </article>

      <article v-if="scoreStoryId" class="panel stack">
        <h3>STAR-score</h3>
        <label v-for="key in starRubricCriteria" :key="key">
          {{ starRubricCriterionLabels[key] }}
          <input v-model.number="scoreDraft.scores[key]" type="number" min="1" max="5" />
        </label>
        <label>Notat <input v-model="scoreDraft.note" /></label>
        <button type="button" @click="submitScore">Lagre score</button>
      </article>
    </template>

    <template v-else>
      <article class="panel stack">
        <h3>Logg case-øving</h3>
        <label>Tittel <input v-model="logForm.title" /></label>
        <label>Utfall <input v-model="logForm.outcome" placeholder="f.eks. solid struktur" /></label>
        <label>Notater <textarea v-model="logForm.notes" rows="3" /></label>
        <button type="button" @click="addLog">Lagre logg</button>
      </article>
      <article class="panel stack">
        <h3>Repertoire</h3>
        <ul class="plain-list">
          <li v-for="log in logs" :key="log.id">
            <strong>{{ log.title }}</strong> — {{ log.outcome }}
            <p class="field-hint">{{ log.notes }}</p>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
