<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  addNote: [];
  close: [];
}>();
</script>

<template>
  <div
    class="board-context-menu board-pane-menu panel"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <button type="button" class="ghost board-context-menu-item" @click="emit('addNote')">Lag notat her</button>
    <button type="button" class="ghost board-context-menu-item" @click="emit('close')">Avbryt</button>
  </div>
</template>
