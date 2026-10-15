<script setup lang="ts">
import {
  DEFAULT_RESEARCH_MODEL,
  researchModelLabels,
  researchModels,
  type ResearchModel
} from "@careercenter/shared";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";

const router = useRouter();
const companyName = ref("");
const roleTitle = ref("");
const jobAdText = ref("");
const researchModel = ref<ResearchModel>(DEFAULT_RESEARCH_MODEL);
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  if (!companyName.value.trim()) return;
  loading.value = true;
  error.value = null;
  try {
    const plan = await interviewPrepApi.createPlan({
      companyName: companyName.value.trim(),
      roleTitle: roleTitle.value.trim(),
      jobAdText: jobAdText.value.trim(),
      format: "interview",
      researchModel: researchModel.value
    });
    await interviewPrepApi.startPlanResearch(plan.id);
    await router.push({ name: "interview-plan", params: { id: plan.id } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke opprette plan.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Ny prep-plan"
      lead="Oppgi bedrift, stilling og lim inn stillingsannonsen. Du følger hvert steg på neste side mens research kjører."
    />
    <form class="panel stack" @submit.prevent="submit">
      <label>
        Bedrift
        <input v-model="companyName" required />
      </label>
      <label>
        Rolle
        <input v-model="roleTitle" />
      </label>
      <label>
        Stillingsannonse (lim inn tekst)
        <textarea
          v-model="jobAdText"
          rows="8"
          placeholder="Lim inn annonseteksten her (valgfritt, men anbefalt)."
        />
      </label>
      <label>
        Reasoning-modell
        <select v-model="researchModel">
          <option v-for="model in researchModels" :key="model" :value="model">
            {{ researchModelLabels[model] }}
          </option>
        </select>
      </label>
      <p class="muted-hint">Modellen brukes til nettsøk, research, bedriftsrapport, oppklaring og kuratering for denne planen.</p>
      <p v-if="error" class="error-text">{{ error }}</p>
      <AppButton type="submit" :loading="loading">
        {{ loading ? "Starter …" : "Opprett og start research" }}
      </AppButton>
    </form>
  </section>
</template>
