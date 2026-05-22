<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { nextTick, ref, watch } from "vue";
import type { BoardMilestoneNodeData } from "@careercenter/shared";
import { useBoardStore } from "../../stores/board.js";

const props = defineProps<{
  id: string;
  data: BoardMilestoneNodeData;
}>();

const boardStore = useBoardStore();
const draft = ref(props.data.label);
const inputRef = ref<HTMLInputElement | null>(null);

const isEditing = () => boardStore.editingNodeId === props.id;

function startEdit() {
  draft.value = props.data.label;
  boardStore.startNodeEdit(props.id);
  void nextTick(() => inputRef.value?.focus());
}

function commitEdit() {
  const label = draft.value.trim() || "Ny milepæl";
  boardStore.updateNodeData(props.id, { label });
  boardStore.clearNodeEdit();
}

watch(
  () => props.data.label,
  (label) => {
    if (!isEditing()) draft.value = label;
  }
);

watch(
  () => boardStore.editingNodeId,
  (id) => {
    if (id === props.id) {
      draft.value = props.data.label;
      void nextTick(() => inputRef.value?.focus());
    }
  }
);
</script>

<template>
  <div class="board-node board-node-milestone" @dblclick.stop="startEdit">
    <Handle type="target" :position="Position.Top" />
    <span class="board-node-tag">Milepæl</span>
    <input
      v-if="isEditing()"
      ref="inputRef"
      v-model="draft"
      class="board-node-input"
      @keydown.enter="commitEdit"
      @keydown.escape="boardStore.clearNodeEdit()"
      @blur="commitEdit"
      @click.stop
    />
    <strong v-else>{{ data.label }}</strong>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
