<script setup lang="ts">
import type { InterviewPrepPlanDto } from "@careercenter/shared";
import { canDeletePrepPlan, canStartSimulators } from "@careercenter/shared";
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import StatusBadge from "../../components/listing/StatusBadge.vue";
import { toneForPrepPlanStatus } from "../../components/interview/statusTone.js";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";
import StateView from "../../components/ui/StateView.vue";

const plans = ref<InterviewPrepPlanDto[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const deleteError = ref<string | null>(null);
const deletingId = ref<string | null>(null);

function practiceCount(plan: InterviewPrepPlanDto): number {
  return plan.questions.filter((q) => q.included && q.audience === "candidate").length;
}

function canPractice(plan: InterviewPrepPlanDto): boolean {
  return canStartSimulators(plan.status) && practiceCount(plan) > 0;
}

function updatedLabel(plan: InterviewPrepPlanDto): string {
  return new Date(plan.updatedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

async function deletePlan(plan: InterviewPrepPlanDto) {
  if (!confirm(`Slette planen for «${plan.companyName}»? Spørsmål, svar og bedriftsrapport slettes. Øvingsøktene blir liggende.`)) {
    return;
  }
  deletingId.value = plan.id;
  deleteError.value = null;
  try {
    await interviewPrepApi.deletePlan(plan.id);
    plans.value = plans.value.filter((item) => item.id !== plan.id);
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : "Kunne ikke slette planen.";
  } finally {
    deletingId.value = null;
  }
}

onMounted(async () => {
  try {
    plans.value = await interviewPrepApi.plans();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Kunne ikke hente planer.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Mine planer"
      lead="Alle prep-planer lagres automatisk. Åpne en plan for å fortsette, eller øv med den i simulatoren."
    >
      <template #actions>
        <RouterLink :to="{ name: 'interview-plan-new' }" custom v-slot="{ navigate }">
          <button type="button" class="primary" @click="navigate">Ny plan</button>
        </RouterLink>
      </template>
    </PageHeader>

    <StateView v-if="loading" state="loading" message="Henter planer …" />
    <StateView v-else-if="error" state="error" :message="error" />
    <StateView v-else-if="!plans.length" state="empty" message="Du har ingen planer ennå. Lag en ny for å komme i gang." />
    <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
    <ul v-if="!loading && !error && plans.length" class="plain-list" data-test="plan-list">
      <li v-for="plan in plans" :key="plan.id" class="plan-row">
        <div class="plan-row-main">
          <strong>{{ plan.companyName }}</strong>
          <span class="field-hint">
            {{ plan.roleTitle || "Rolle ikke spesifisert" }} · {{ practiceCount(plan) }} spørsmål i øving · oppdatert
            {{ updatedLabel(plan) }}
          </span>
        </div>
        <div class="plan-row-actions">
          <StatusBadge v-bind="toneForPrepPlanStatus(plan.status)" />
          <RouterLink :to="{ name: 'interview-plan', params: { id: plan.id } }" custom v-slot="{ navigate }">
            <button type="button" class="secondary mini-btn" @click="navigate">Åpne</button>
          </RouterLink>
          <RouterLink
            v-if="canPractice(plan)"
            :to="{ name: 'interview-simulator', query: { planId: plan.id } }"
            custom
            v-slot="{ navigate }"
          >
            <button type="button" class="primary mini-btn" @click="navigate">Øv</button>
          </RouterLink>
          <AppButton
            variant="ghost"
            class="mini-btn"
            :loading="deletingId === plan.id"
            :disabled="!canDeletePrepPlan(plan.status)"
            :title="canDeletePrepPlan(plan.status) ? undefined : 'Stopp planen før du sletter den.'"
            @click="deletePlan(plan)"
          >
            Slett
          </AppButton>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.plan-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.plan-row-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.plan-row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
