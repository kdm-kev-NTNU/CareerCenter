<script setup lang="ts">
defineProps<{
  label: string;
  variant?: "accent" | "muted" | "blue" | "danger";
}>();
</script>

<template>
  <span class="status-badge" :class="variant ?? 'muted'">{{ label }}</span>
</template>
