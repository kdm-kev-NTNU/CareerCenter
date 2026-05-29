<script setup lang="ts">
defineProps<{
  url?: string | null;
  showPromote?: boolean;
  inDatabase?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
  promote: [];
}>();
</script>

<template>
  <div class="listing-actions" @click.stop>
    <span
      v-if="inDatabase"
      class="listing-db-badge"
      title="Bedriften finnes i Bedriftsbasen"
      aria-label="I Bedriftsbasen"
    >✓</span>
    <button
      v-if="showPromote"
      type="button"
      class="listing-icon-btn"
      aria-label="Legg til i Bedriftsbase"
      title="Legg til i Bedriftsbase"
      @click="emit('promote')"
    >+</button>
    <button type="button" class="listing-icon-btn" aria-label="Rediger" title="Rediger" @click="emit('edit')">✎</button>
    <a
      v-if="url"
      :href="url"
      class="listing-icon-btn"
      aria-label="Åpne lenke"
      title="Åpne lenke"
      target="_blank"
      rel="noreferrer"
      @click.stop
    >↗</a>
    <button type="button" class="listing-icon-btn listing-icon-btn--danger" aria-label="Slett" title="Slett" @click="emit('delete')">×</button>
  </div>
</template>
