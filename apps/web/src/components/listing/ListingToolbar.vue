<script setup lang="ts">
defineEmits<{
  add: [];
}>();
</script>

<template>
  <div class="listing-toolbar panel">
    <div class="listing-toolbar-filters">
      <slot name="filters" />
    </div>
    <button type="button" class="primary listing-toolbar-add" @click="$emit('add')">+ Legg til</button>
  </div>
</template>
