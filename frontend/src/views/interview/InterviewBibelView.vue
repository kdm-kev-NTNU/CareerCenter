<script setup lang="ts">
import type { InterviewCasePublicDto, InterviewKnowledgeDocDto } from "@careercenter/shared";
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

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
    <PageHeader
      title="Intervjubibel"
      lead="Importer PDF/tekst og bygg casebiblioteket."
    />

    <article class="panel stack">
      <h3>Importer dokument</h3>
      <StateView v-if="uploading" state="loading" message="Importerer …" />
      <label class="file-picker">
        Velg fil …
        <input type="file" accept=".txt,.md,.docx,.pdf,.zip" @change="onFileInput" />
      </label>
    </article>

    <article class="panel stack">
      <h3>Legg til manuelt</h3>
      <form class="stack" @submit.prevent="createDoc">
        <input v-model="newTitle" placeholder="Tittel" required />
        <textarea v-model="newContent" rows="4" placeholder="Innhold" />
        <AppButton type="submit">Lagre</AppButton>
      </form>
    </article>

    <StateView v-if="error" state="error" :message="error" />
    <StateView v-if="loading" state="loading" />

    <article v-if="!loading" class="panel stack">
      <h3>Dokumenter ({{ docs.length }})</h3>
      <StateView v-if="!docs.length" state="empty" message="Ingen dokumenter ennå. Importer den første filen." />
      <ul v-else class="plain-list">
        <li v-for="doc in docs" :key="doc.id" class="panel-heading-row">
          <div>
            <strong>{{ doc.title }}</strong>
            <span class="field-hint">{{ doc.kind }}</span>
          </div>
          <AppButton variant="ghost" class="mini-btn" @click="removeDoc(doc.id)">Slett</AppButton>
        </li>
      </ul>
    </article>

    <article v-if="!loading" class="panel stack">
      <h3>Case (offentlig prompt)</h3>
      <StateView v-if="!cases.length" state="empty" message="Ingen caser ennå." />
      <ul v-else class="plain-list">
        <li v-for="item in cases" :key="item.id">
          <strong>{{ item.title }}</strong>
          <p>{{ item.prompt.slice(0, 240) }}<span v-if="item.prompt.length > 240"> …</span></p>
        </li>
      </ul>
    </article>
  </section>
</template>
