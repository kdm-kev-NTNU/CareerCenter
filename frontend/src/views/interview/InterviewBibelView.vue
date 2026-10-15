<script setup lang="ts">
import {
  canDeleteImportJob,
  importJobKindLabels,
  type InterviewCasePublicDto,
  type InterviewImportJobDto,
  type InterviewKnowledgeDocDto
} from "@careercenter/shared";
import { onMounted, onUnmounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import QuestionBankPanel from "../../components/interview/QuestionBankPanel.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const tab = ref<"bibliotek" | "sok" | "godkjenning">("bibliotek");
const loading = ref(true);
const error = ref<string | null>(null);
const docs = ref<InterviewKnowledgeDocDto[]>([]);
const cases = ref<InterviewCasePublicDto[]>([]);
const pendingCases = ref<InterviewCasePublicDto[]>([]);
const jobs = ref<InterviewImportJobDto[]>([]);
const uploading = ref(false);
const newTitle = ref("");
const newContent = ref("");
const caseSearchQ = ref("");
const caseHits = ref<InterviewCasePublicDto[]>([]);
const searching = ref(false);
const aiConfigured = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  loading.value = true;
  error.value = null;
  try {
    [docs.value, cases.value, pendingCases.value, jobs.value] = await Promise.all([
      interviewPrepApi.knowledgeDocs(),
      interviewPrepApi.cases(),
      interviewPrepApi.cases({ approvalStatus: "pending" }),
      interviewPrepApi.importJobs()
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke laste bibel.";
  } finally {
    loading.value = false;
  }
}

async function refreshJobs() {
  jobs.value = await interviewPrepApi.importJobs();
}

onMounted(() => {
  void refresh();
  void interviewPrepApi
    .getStatus()
    .then((status) => {
      aiConfigured.value = status.aiConfigured;
    })
    .catch(() => {
      aiConfigured.value = false;
    });
  pollTimer = setInterval(() => {
    const active = jobs.value.some((job) => job.status === "queued" || job.status === "running");
    if (!active) return;
    void interviewPrepApi.importJobs().then(async (rows) => {
      const stillActive = rows.some((job) => job.status === "queued" || job.status === "running");
      jobs.value = rows;
      if (!stillActive) {
        [cases.value, pendingCases.value] = await Promise.all([
          interviewPrepApi.cases(),
          interviewPrepApi.cases({ approvalStatus: "pending" })
        ]);
      }
    });
  }, 4000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

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

async function searchCases() {
  searching.value = true;
  error.value = null;
  try {
    caseHits.value = await interviewPrepApi.cases({ q: caseSearchQ.value.trim() || undefined });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Søk feilet.";
  } finally {
    searching.value = false;
  }
}

async function approve(id: string) {
  await interviewPrepApi.approveCase(id);
  await refresh();
}

async function reject(id: string) {
  await interviewPrepApi.rejectCase(id);
  await refresh();
}

function sourceLabel(knowledgeDocId?: string): string {
  if (!knowledgeDocId) return "";
  const doc = docs.value.find((item) => item.id === knowledgeDocId);
  return doc?.sourceFilename || doc?.title || "";
}

async function retryJob(id: string) {
  error.value = null;
  try {
    await interviewPrepApi.retryImportJob(id);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke fortsette importen.";
  }
}

async function stopJob(id: string) {
  error.value = null;
  try {
    await interviewPrepApi.cancelImportJob(id);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke stoppe importen.";
  }
}

async function removeJob(id: string) {
  if (!confirm("Fjerne denne importen fra listen? Dokumentet og eventuelle caseutkast blir liggende.")) return;
  error.value = null;
  try {
    await interviewPrepApi.deleteImportJob(id);
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke slette importen.";
  }
}
</script>

<template>
  <section class="stack">
    <PageHeader title="Intervjubibel" lead="Importer PDF/tekst, søk i banken og godkjenn exhibits." />

    <div class="form-grid">
      <AppButton :variant="tab === 'bibliotek' ? 'primary' : 'secondary'" @click="tab = 'bibliotek'">Bibliotek</AppButton>
      <AppButton :variant="tab === 'sok' ? 'primary' : 'secondary'" @click="tab = 'sok'">Søk</AppButton>
      <AppButton :variant="tab === 'godkjenning' ? 'primary' : 'secondary'" @click="tab = 'godkjenning'">
        Godkjenning
      </AppButton>
    </div>

    <StateView v-if="error" state="error" :message="error" />

    <template v-if="tab === 'bibliotek'">
      <article class="panel stack">
        <h3>Importer dokument</h3>
        <p class="field-hint">Maks 50 MB. PDF, DOCX, TXT, MD eller ZIP.</p>
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

      <article v-if="jobs.length" class="panel stack">
        <h3>Import</h3>
        <ul class="plain-list">
          <li v-for="job in jobs" :key="job.id" class="stack">
            <strong>{{ sourceLabel(job.knowledgeDocId) || "Dokument" }}</strong>
            <span class="field-hint">{{ importJobKindLabels[job.kind] }} · {{ job.status }} · {{ job.progress }}%</span>
            <p>{{ job.message }}</p>
            <div class="form-grid">
              <AppButton
                v-if="job.status === 'queued' || job.status === 'running'"
                variant="secondary"
                @click="stopJob(job.id)"
              >
                Stopp
              </AppButton>
              <AppButton
                v-if="job.status === 'failed' || job.status === 'cancelled'"
                variant="secondary"
                @click="retryJob(job.id)"
              >
                Fortsett
              </AppButton>
              <AppButton v-if="canDeleteImportJob(job.status)" variant="ghost" @click="removeJob(job.id)">
                Slett
              </AppButton>
            </div>
          </li>
        </ul>
      </article>

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
            <span class="field-hint">{{ item.sourceKind }} · {{ item.approvalStatus ?? "approved" }}</span>
            <span v-if="sourceLabel(item.knowledgeDocId)" class="field-hint">{{ sourceLabel(item.knowledgeDocId) }}</span>
            <p>{{ item.prompt.slice(0, 240) }}<span v-if="item.prompt.length > 240"> …</span></p>
          </li>
        </ul>
      </article>
    </template>

    <template v-else-if="tab === 'sok'">
      <QuestionBankPanel :docs="docs" :jobs="jobs" :ai-configured="aiConfigured" @jobs-changed="refreshJobs" />

      <article class="panel stack">
        <h3>Case-søk</h3>
        <label>
          Søk <input v-model="caseSearchQ" placeholder="f.eks. profitability" @keyup.enter="searchCases" />
        </label>
        <AppButton :loading="searching" @click="searchCases">Søk i caser</AppButton>
        <StateView v-if="!caseHits.length" state="empty" message="Ingen case-treff." />
        <ul v-else class="plain-list">
          <li v-for="item in caseHits" :key="item.id">
            <strong>{{ item.title }}</strong>
            <p>{{ item.prompt.slice(0, 200) }}</p>
          </li>
        </ul>
      </article>
    </template>

    <template v-else>
      <article class="panel stack">
        <h3>Importjobber</h3>
        <StateView v-if="!jobs.length" state="empty" message="Ingen jobber ennå." />
        <ul v-else class="plain-list">
          <li v-for="job in jobs" :key="job.id" class="stack">
            <strong>{{ sourceLabel(job.knowledgeDocId) || job.status }}</strong>
            <span class="field-hint">{{ importJobKindLabels[job.kind] }} · {{ job.status }} · {{ job.progress }}%</span>
            <p>{{ job.message }}</p>
            <div class="form-grid">
              <AppButton
                v-if="job.status === 'queued' || job.status === 'running'"
                variant="secondary"
                @click="stopJob(job.id)"
              >
                Stopp
              </AppButton>
              <AppButton
                v-if="job.status === 'failed' || job.status === 'cancelled'"
                variant="secondary"
                @click="retryJob(job.id)"
              >
                Fortsett
              </AppButton>
              <AppButton v-if="canDeleteImportJob(job.status)" variant="ghost" @click="removeJob(job.id)">
                Slett
              </AppButton>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel stack">
        <h3>Venter på godkjenning ({{ pendingCases.length }})</h3>
        <StateView v-if="!pendingCases.length" state="empty" message="Ingen pending cases." />
        <ul v-else class="plain-list">
          <li v-for="item in pendingCases" :key="item.id" class="stack">
            <strong>{{ item.title }}</strong>
            <span v-if="sourceLabel(item.knowledgeDocId)" class="field-hint">{{ sourceLabel(item.knowledgeDocId) }}</span>
            <p>{{ item.prompt.slice(0, 280) }}</p>
            <div class="form-grid">
              <AppButton @click="approve(item.id)">Godkjenn</AppButton>
              <AppButton variant="ghost" @click="reject(item.id)">Avvis</AppButton>
            </div>
          </li>
        </ul>
      </article>
    </template>
  </section>
</template>
