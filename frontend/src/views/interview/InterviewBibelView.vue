<script setup lang="ts">
import type { InterviewCasePublicDto, InterviewKnowledgeDocDto } from "@careercenter/shared";
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";

const loading = ref(true);
const error = ref<string | null>(null);
const docs = ref<InterviewKnowledgeDocDto[]>([]);
const cases = ref<InterviewCasePublicDto[]>([]);
const uploading = ref(false);
const newTitle = ref("");
const newContent = ref("");

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    [docs.value, cases.value] = await Promise.all([interviewPrepApi.knowledgeDocs(), interviewPrepApi.cases()]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste bibel.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => void refresh());

async function createDoc() {
  if (!newTitle.value.trim()) return;
  await interviewPrepApi.createKnowledge({ title: newTitle.value.trim(), content: newContent.value });
  newTitle.value = "";
  newContent.value = "";
  await refresh();
}

async function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploading.value = true;
  error.value = null;
  try {
    await interviewPrepApi.importKnowledge(file);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Import feilet.";
  } finally {
    uploading.value = false;
  }
}

async function removeDoc(id: string) {
  await interviewPrepApi.deleteKnowledge(id);
  await refresh();
}
</script>

<template>
  <section class="stack">
    <article class="panel strong">
      <h2>Intervjubibel</h2>
      <p>Kunnskapsbase og case – løsning og intervjuer-notater skjules i lister.</p>
    </article>

    <article class="panel stack">
      <h3>Importer dokument</h3>
      <p v-if="uploading">Importerer …</p>
      <input type="file" accept=".txt,.md,.docx,.pdf,.zip" @change="onFileInput" />
    </article>

    <article class="panel stack">
      <h3>Legg til manuelt</h3>
      <form class="stack" @submit.prevent="createDoc">
        <input v-model="newTitle" placeholder="Tittel" required />
        <textarea v-model="newContent" rows="4" placeholder="Innhold" />
        <button type="submit">Lagre</button>
      </form>
    </article>

    <p v-if="error">{{ error }}</p>
    <p v-if="loading">Laster …</p>

    <article v-if="!loading" class="panel stack">
      <h3>Dokumenter ({{ docs.length }})</h3>
      <ul class="plain-list">
        <li v-for="doc in docs" :key="doc.id">
          <strong>{{ doc.title }}</strong> — {{ doc.kind }}
          <button type="button" class="ghost mini-btn" @click="removeDoc(doc.id)">Slett</button>
        </li>
      </ul>
    </article>

    <article v-if="!loading" class="panel stack">
      <h3>Case (offentlig prompt)</h3>
      <ul class="plain-list">
        <li v-for="item in cases" :key="item.id">
          <strong>{{ item.title }}</strong>
          <p>{{ item.prompt.slice(0, 240) }}<span v-if="item.prompt.length > 240"> …</span></p>
        </li>
      </ul>
    </article>
  </section>
</template>
