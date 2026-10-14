<script setup lang="ts">
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";

const loading = ref(true);
const aiConfigured = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const status = await interviewPrepApi.getStatus();
    aiConfigured.value = status.aiConfigured;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente AI-status.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="stack">
    <article class="panel strong">
      <h2>Interview Mecca</h2>
      <p>Forberedelse til intervjuer, case og evnetester – med egen kunnskapsbase og AI-støtte.</p>
    </article>

    <article class="panel">
      <h2>AI-status</h2>
      <p v-if="loading">Henter status …</p>
      <p v-else-if="error">{{ error }}</p>
      <p v-else-if="aiConfigured">OpenAI er konfigurert. Bibel, plan og simulator er tilgjengelige.</p>
      <p v-else>
        AI er ikke konfigurert. Sett <code>OPENAI_API_KEY</code> på backend for å aktivere.
      </p>
    </article>
  </section>
</template>
