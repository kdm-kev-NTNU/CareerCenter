<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from "@vue-flow/core";
import { computed, nextTick, ref, watch } from "vue";
import { useBoardStore } from "../../stores/board.js";

const props = defineProps<EdgeProps>();
const boardStore = useBoardStore();
const editing = ref(false);
const draft = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const labelText = computed(
  () =>
    (typeof props.label === "string" ? props.label : "") ||
    ((props.data as { label?: string } | undefined)?.label ?? "")
);

const path = computed(() =>
  getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition
  })
);

const labelX = computed(() => path.value[1]);
const labelY = computed(() => path.value[2]);

function startEdit() {
  draft.value = labelText.value;
  editing.value = true;
  boardStore.selectEdge(props.id);
  void nextTick(() => inputRef.value?.focus());
}

function commitEdit() {
  boardStore.selectedEdgeId = props.id;
  boardStore.edgeLabelDraft = draft.value;
  boardStore.applyEdgeLabel(draft.value);
  editing.value = false;
  boardStore.clearEdgeLabelEditRequest();
}

watch(
  () => boardStore.edgeLabelEditRequestId,
  (edgeId) => {
    if (edgeId === props.id) startEdit();
  }
);

watch(labelText, (value) => {
  if (!editing.value) draft.value = value;
});
</script>

<template>
  <BaseEdge :id="id" :path="path[0]" :marker-end="markerEnd" :style="style" />
  <EdgeLabelRenderer>
    <div
      class="board-edge-label nodrag nopan"
      :class="{ 'board-edge-label--editing': editing, 'board-edge-label--selected': selected }"
      :style="{
        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
      }"
      @dblclick.stop="startEdit"
    >
      <input
        v-if="editing"
        ref="inputRef"
        v-model="draft"
        class="board-edge-label-input"
        placeholder="f.eks. 2-3 år"
        @keydown.enter="commitEdit"
        @keydown.escape="editing = false; boardStore.clearEdgeLabelEditRequest()"
        @blur="commitEdit"
        @click.stop
      />
      <button
        v-else
        type="button"
        class="board-edge-label-btn"
        :title="labelText || 'Dobbeltklikk for etikett'"
        @click.stop="startEdit"
      >
        {{ labelText || "+" }}
      </button>
    </div>
  </EdgeLabelRenderer>
</template>
