<script setup lang="ts">
defineProps<{
  title: string;
  lead?: string;
}>();
</script>

<template>
  <article class="panel strong page-header">
    <div class="page-header-main">
      <h2>{{ title }}</h2>
      <p v-if="lead">{{ lead }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </article>
</template>
