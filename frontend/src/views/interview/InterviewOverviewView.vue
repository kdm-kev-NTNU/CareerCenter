<script setup lang="ts">
import { RouterLink } from "vue-router";
import { onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";
import StatusBadge from "../../components/listing/StatusBadge.vue";

const loading = ref(true);
const aiConfigured = ref(false);
const error = ref<string | null>(null);

const modules = [
  { to: "/interview/plan", title: "Mine planer", desc: "Lagrede prep-planer. Fortsett der du slapp, eller øv med dem i simulatoren." },
  { to: "/interview/plan/ny", title: "Ny prep-plan", desc: "Fyll inn bedrift + annonse. Agenten researcher og lager spørsmål." },
  { to: "/interview/bibel", title: "Intervjubibel", desc: "Importer dokumenter og casebøker." },
  { to: "/interview/simulator", title: "Intervjussimulator", desc: "Stemmeintervju med STAR-scoring." },
  { to: "/interview/video", title: "Videosøknad", desc: "Kort med betenkningstid og opptak." },
  { to: "/interview/evnetester", title: "Evnetester", desc: "Øving gruppert per testaktør (AON m.fl.)." }
];

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
    <PageHeader
      title="Intervju"
      lead="Fra søknad til kuratert prep — simulatorer, casebibliotek og evnetester."
    >
      <template #meta>
        <StateView v-if="loading" state="loading" message="Henter AI-status …" />
        <StateView v-else-if="error" state="error" :message="error" />
        <StatusBadge
          v-else
          :label="aiConfigured ? 'KI konfigurert · klar' : 'KI ikke konfigurert'"
          :variant="aiConfigured ? 'accent' : 'danger'"
        />
      </template>
    </PageHeader>

    <article v-if="!aiConfigured && !loading && !error" class="panel stack">
      <h3>KI ikke konfigurert</h3>
      <p class="error-text">
        Sett <code>OPENAI_API_KEY</code> på backend. Import og evnetester fungerer fortsatt.
      </p>
    </article>

    <div class="module-grid">
      <RouterLink
        v-for="item in modules"
        :key="item.to"
        :to="item.to"
        class="module-card"
      >
        <strong>{{ item.title }}</strong>
        <span>{{ item.desc }}</span>
      </RouterLink>
    </div>
  </section>
</template>
