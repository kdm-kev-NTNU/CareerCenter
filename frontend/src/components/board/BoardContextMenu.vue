<script setup lang="ts">
export type BoardContextMenuTarget =
  | { kind: "node"; id: string; type?: string }
  | { kind: "edge"; id: string }
  | null;

defineProps<{
  target: BoardContextMenuTarget;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  edit: [];
  duplicate: [];
  delete: [];
  close: [];
}>();
</script>

<template>
  <div
    v-if="target"
    class="board-context-menu panel"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <button type="button" class="ghost board-context-menu-item" @click="emit('edit')">Rediger</button>
    <button
      v-if="target.kind === 'node'"
      type="button"
      class="ghost board-context-menu-item"
      @click="emit('duplicate')"
    >
      Dupliser node
    </button>
    <button type="button" class="ghost board-context-menu-item board-context-menu-item--danger" @click="emit('delete')">
      Slett
    </button>
  </div>
</template>
