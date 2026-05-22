<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <details class="catalog-settings panel">
    <summary>{{ title ?? "Innstillinger – kataloger" }}</summary>
    <div class="catalog-settings-body grid three catalog-grid">
      <slot />
    </div>
  </details>
</template>
