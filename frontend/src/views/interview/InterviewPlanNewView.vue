<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";

const router = useRouter();
const companyName = ref("");
const roleTitle = ref("");
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
      format: "interview"
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
      lead="Oppgi bedrift og stilling. Research starter automatisk."
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
      <p v-if="error" class="error-text">{{ error }}</p>
      <AppButton type="submit" :loading="loading">
        {{ loading ? "Starter …" : "Opprett og start research" }}
      </AppButton>
    </form>
  </section>
</template>
