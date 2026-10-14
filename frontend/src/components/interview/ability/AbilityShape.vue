<script setup lang="ts">
export type AbilityShapeKind = "circle" | "square" | "triangle" | "cross" | "star";

withDefaults(
  defineProps<{
    shape: AbilityShapeKind;
    color: string;
    size?: number;
  }>(),
  { size: 24 }
);
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" role="img" :aria-label="shape">
    <circle v-if="shape === 'circle'" cx="12" cy="12" r="9" :fill="color" />
    <rect v-else-if="shape === 'square'" x="3.5" y="3.5" width="17" height="17" :fill="color" />
    <polygon v-else-if="shape === 'triangle'" points="12,3 21.5,20.5 2.5,20.5" :fill="color" />
    <path
      v-else-if="shape === 'cross'"
      d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"
      :fill="color"
    />
    <polygon
      v-else
      points="12,2.5 14.6,9 21.5,9.3 16.1,13.6 18,20.5 12,16.6 6,20.5 7.9,13.6 2.5,9.3 9.4,9"
      :fill="color"
    />
  </svg>
</template>
