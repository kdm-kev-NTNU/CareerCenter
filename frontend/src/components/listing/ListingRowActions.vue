<script setup lang="ts">
defineProps<{
  url?: string | null;
}>();

const emit = defineEmits<{
  edit: [];
  delete: [];
}>();
</script>

<template>
  <div class="listing-actions" @click.stop>
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
