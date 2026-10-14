<script setup lang="ts">
import type { ScalesClxPuzzle } from "@careercenter/shared";
import ClxGrid from "./ClxGrid.vue";

const props = defineProps<{
  puzzle: ScalesClxPuzzle;
  selected: number[];
  revealed: boolean;
}>();

const emit = defineEmits<{
  toggle: [index: number];
}>();

function isCorrect(i: number): boolean {
  return props.puzzle.correctIndices.includes(i);
}
</script>

<template>
  <div class="clx-board">
    <section class="clx-card clx-card--examples">
      <h3>Disse to rutenettene følger en regel</h3>
      <div class="clx-examples">
        <ClxGrid v-for="(grid, i) in puzzle.examples" :key="`ex-${i}`" :grid="grid" />
      </div>
    </section>

    <section class="clx-card">
      <h3>Hvilke to av disse følger samme regel?</h3>
      <div class="clx-candidates">
        <button
          v-for="(grid, i) in puzzle.candidates"
          :key="`cand-${i}`"
          type="button"
          class="clx-candidate"
          :class="{
            'is-selected': selected.includes(i),
            'is-correct': revealed && isCorrect(i),
            'is-wrong': revealed && selected.includes(i) && !isCorrect(i)
          }"
          :disabled="revealed"
          :aria-pressed="selected.includes(i)"
          :aria-label="`Kandidat ${i + 1}`"
          @click="emit('toggle', i)"
        >
          <ClxGrid :grid="grid" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.clx-board {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 2fr);
  gap: 24px;
  align-items: stretch;
}
@media (max-width: 720px) {
  .clx-board { grid-template-columns: 1fr; }
}
.clx-card {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 16px;
  padding: 16px 20px 24px;
  background: var(--surface);
  border: 1.5px solid #3d4a55;
  border-radius: 18px;
}
.clx-card h3 {
  margin: 0;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: #3d4a55;
}
.clx-examples {
  display: grid;
  justify-items: center;
  align-content: space-around;
  gap: 48px;
}
.clx-candidates {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  justify-items: center;
  align-content: space-around;
  gap: 32px 24px;
}
.clx-candidate {
  padding: 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: transparent;
}
.clx-candidate:hover:not(:disabled) { background: #f1f3f6; }
.clx-candidate.is-selected {
  border-color: var(--blue);
  background: #e8f0fc;
}
.clx-candidate.is-correct {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.clx-candidate.is-wrong {
  border-color: var(--danger);
  background: #fee4e2;
}
.clx-candidate:disabled { cursor: default; opacity: 1; }
</style>
