<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { nextTick, ref, watch } from "vue";
import type { BoardNoteNodeData } from "@careercenter/shared";
import { useBoardStore } from "../../stores/board.js";

const props = defineProps<{
  id: string;
  data: BoardNoteNodeData;
}>();

const boardStore = useBoardStore();
const draft = ref(props.data.text);
const inputRef = ref<HTMLTextAreaElement | null>(null);

const isEditing = () => boardStore.editingNodeId === props.id;

function startEdit() {
  draft.value = props.data.text;
  boardStore.startNodeEdit(props.id);
  void nextTick(() => inputRef.value?.focus());
}

function commitEdit() {
  const text = draft.value.trim() || "Notat";
  boardStore.updateNodeData(props.id, { text });
  boardStore.clearNodeEdit();
}

watch(
  () => props.data.text,
  (text) => {
    if (!isEditing()) draft.value = text;
  }
);

watch(
  () => boardStore.editingNodeId,
  (id) => {
    if (id === props.id) {
      draft.value = props.data.text;
      void nextTick(() => inputRef.value?.focus());
    }
  }
);
</script>

<template>
  <div class="board-node board-node-note" @dblclick.stop="startEdit">
    <Handle type="target" :position="Position.Left" />
    <span class="board-node-tag">Notat</span>
    <textarea
      v-if="isEditing()"
      ref="inputRef"
      v-model="draft"
      class="board-node-textarea nodrag nopan"
      rows="5"
      placeholder="Skriv tankene dine …"
      @keydown.escape="boardStore.clearNodeEdit()"
      @blur="commitEdit"
      @click.stop
    />
    <p v-else>{{ data.text }}</p>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
