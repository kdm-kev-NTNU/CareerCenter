<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { computed, nextTick, ref, watch } from "vue";
import type { BoardCompanyNodeData } from "@careercenter/shared";
import { useBoardStore } from "../../stores/board.js";
import { useCompaniesStore } from "../../stores/companies.js";

const props = defineProps<{
  id: string;
  data: BoardCompanyNodeData;
}>();

const boardStore = useBoardStore();
const companiesStore = useCompaniesStore();
const company = computed(() => companiesStore.companies.find((entry) => entry.id === props.data.companyId));
const draft = ref(props.data.note ?? "");
const inputRef = ref<HTMLInputElement | null>(null);

const isEditing = () => boardStore.editingNodeId === props.id;

function startEdit() {
  draft.value = props.data.note ?? "";
  boardStore.startNodeEdit(props.id);
  void nextTick(() => inputRef.value?.focus());
}

function commitEdit() {
  boardStore.updateNodeData(props.id, { note: draft.value.trim() });
  boardStore.clearNodeEdit();
}

watch(
  () => props.data.note,
  (note) => {
    if (!isEditing()) draft.value = note ?? "";
  }
);

watch(
  () => boardStore.editingNodeId,
  (id) => {
    if (id === props.id) {
      draft.value = props.data.note ?? "";
      void nextTick(() => inputRef.value?.focus());
    }
  }
);
</script>

<template>
  <div class="board-node board-node-company" @dblclick.stop="startEdit">
    <Handle type="target" :position="Position.Top" />
    <strong>{{ company?.name ?? "Ukjent bedrift" }}</strong>
    <small v-if="company">Tier {{ company.tier }} · {{ company.geography }}</small>
    <input
      v-if="isEditing()"
      ref="inputRef"
      v-model="draft"
      class="board-node-input"
      placeholder="Notat om bedriften"
      @keydown.enter="commitEdit"
      @keydown.escape="boardStore.clearNodeEdit()"
      @blur="commitEdit"
      @click.stop
    />
    <p v-else-if="data.note" class="board-node-note">{{ data.note }}</p>
    <small v-else class="board-node-hint">Dobbeltklikk for notat</small>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
