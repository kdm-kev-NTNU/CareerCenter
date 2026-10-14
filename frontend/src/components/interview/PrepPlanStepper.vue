<script setup lang="ts">
import type { InterviewPrepPlanDto, PrepPlanPipelineStep } from "@careercenter/shared";
import { prepPlanPipelineSteps, prepPlanStepVisual } from "@careercenter/shared";
import { prepPlanPipelineStepLabel } from "./statusTone.js";

const props = defineProps<{
  plan: InterviewPrepPlanDto;
  selected: PrepPlanPipelineStep;
}>();

const emit = defineEmits<{
  select: [step: PrepPlanPipelineStep];
}>();

function visual(step: PrepPlanPipelineStep) {
  return prepPlanStepVisual(step, props.plan.pipelineStep, props.plan.status);
}

function choose(step: PrepPlanPipelineStep) {
  if (visual(step) === "pending") return;
  emit("select", step);
}
</script>

<template>
  <ol class="plan-steps" data-test="plan-steps">
    <li v-for="(step, index) in prepPlanPipelineSteps" :key="step">
      <button
        type="button"
        class="plan-step"
        :class="[`plan-step--${visual(step)}`, { 'plan-step--selected': step === selected }]"
        :data-test="`plan-step-${step}`"
        :data-state="visual(step)"
        :aria-current="step === selected ? 'step' : undefined"
        :disabled="visual(step) === 'pending'"
        @click="choose(step)"
      >
        <span class="plan-step-index" aria-hidden="true">{{ index + 1 }}</span>
        <span>{{ prepPlanPipelineStepLabel[step] }}</span>
      </button>
    </li>
  </ol>
</template>
