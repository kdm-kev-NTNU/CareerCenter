<script setup lang="ts">
defineProps<{
  columns: string[];
  layout?: "default" | "competitions";
}>();
</script>

<template>
  <div class="listing-table panel" :class="layout === 'competitions' ? 'listing-table--competitions' : ''">
    <div class="listing-header" role="row">
      <span v-for="col in columns" :key="col" class="listing-header-cell" role="columnheader">{{ col }}</span>
    </div>
    <div class="listing-body">
      <slot />
    </div>
  </div>
</template>
