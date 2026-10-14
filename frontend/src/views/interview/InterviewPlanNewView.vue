<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";

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
    <article class="panel strong">
      <h2>Ny forberedelsesplan</h2>
      <p>Research, avklaringsspørsmål og kuratert plan for selskapet.</p>
    </article>
    <form class="panel stack" @submit.prevent="submit">
      <label>
        Selskap
        <input v-model="companyName" required />
      </label>
      <label>
        Rolle
        <input v-model="roleTitle" />
      </label>
      <p v-if="error">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? "Starter …" : "Opprett og start research" }}</button>
    </form>
  </section>
</template>
