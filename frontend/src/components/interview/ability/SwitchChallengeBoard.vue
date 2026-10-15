<script setup lang="ts">
import type { SwitchChallengePuzzle, SwitchSymbol } from "@careercenter/shared";
import AbilityShape from "./AbilityShape.vue";
import { switchSymbolColor } from "./abilityPalette.js";

const props = defineProps<{
  puzzle: SwitchChallengePuzzle;
  /** Stage 1: selected option index. Stage 2: ignored (use selectedPair). */
  selectedIndex: number | null;
  /** Stage 2: selected index per row. */
  selectedPair: [number | null, number | null];
  revealed: boolean;
}>();

const emit = defineEmits<{
  select: [index: number];
  selectRow: [payload: { row: 0 | 1; index: number }];
}>();

function isStage2Correct(row: 0 | 1, index: number): boolean {
  if (props.puzzle.stage !== 2) return false;
  return props.puzzle.correctPair[row] === index;
}

function isStage2Wrong(row: 0 | 1, index: number): boolean {
  if (props.puzzle.stage !== 2 || !props.revealed) return false;
  return props.selectedPair[row] === index && !isStage2Correct(row, index);
}
</script>

<template>
  <div class="switch-board" :class="{ 'is-stage2': puzzle.stage === 2 }">
    <div class="switch-row" aria-label="Input">
      <span v-for="(symbol, i) in puzzle.input" :key="`in-${i}`" class="switch-tile">
        <AbilityShape :shape="symbol" :color="switchSymbolColor[symbol]" />
      </span>
    </div>

    <svg class="switch-funnel" viewBox="0 0 48 40" aria-hidden="true">
      <rect x="2" y="2" width="44" height="6" rx="1" />
      <polygon points="8,8 40,8 30,26 18,26" />
      <rect x="17" y="26" width="14" height="6" rx="1" />
    </svg>

    <!-- Stage 1: single row of codes -->
    <div v-if="puzzle.stage === 1" class="switch-rail">
      <button
        v-for="(code, i) in puzzle.options"
        :key="code"
        type="button"
        class="switch-code"
        :class="{
          'is-selected': selectedIndex === i,
          'is-correct': revealed && i === puzzle.correctIndex,
          'is-wrong': revealed && selectedIndex === i && i !== puzzle.correctIndex
        }"
        :disabled="revealed"
        :aria-pressed="selectedIndex === i"
        @click="emit('select', i)"
      >
        {{ code.split("").join(" ") }}
      </button>
    </div>

    <!-- Stage 2: two rows × 3 codes with constant column-linked previews -->
    <template v-else>
      <div
        v-for="(row, rowIdx) in puzzle.rows"
        :key="`row-${rowIdx}`"
        class="switch-stage2-row"
        :aria-label="rowIdx === 0 ? 'Øvre bryterrad' : 'Nedre bryterrad'"
      >
        <div class="switch-rail switch-rail--stage2">
          <button
            v-for="(code, i) in row.options"
            :key="`${rowIdx}-${code}`"
            type="button"
            class="switch-code-card"
            :class="{
              'is-selected': selectedPair[rowIdx as 0 | 1] === i,
              'is-correct': revealed && isStage2Correct(rowIdx as 0 | 1, i),
              'is-wrong': isStage2Wrong(rowIdx as 0 | 1, i)
            }"
            :disabled="revealed"
            :aria-pressed="selectedPair[rowIdx as 0 | 1] === i"
            @click="emit('selectRow', { row: rowIdx as 0 | 1, index: i })"
          >
            <span class="switch-code-label">{{ code.split("").join(" ") }}</span>
            <span class="switch-preview" aria-hidden="true">
              <span
                v-for="(symbol, si) in row.previews[i] as SwitchSymbol[]"
                :key="`pv-${rowIdx}-${i}-${si}`"
                class="switch-preview-tile"
              >
                <AbilityShape :shape="symbol" :color="switchSymbolColor[symbol]" :size="14" />
              </span>
            </span>
          </button>
        </div>
      </div>
    </template>

    <svg class="switch-funnel is-flipped" viewBox="0 0 48 40" aria-hidden="true">
      <rect x="2" y="2" width="44" height="6" rx="1" />
      <polygon points="8,8 40,8 30,26 18,26" />
      <rect x="17" y="26" width="14" height="6" rx="1" />
    </svg>

    <div class="switch-row" aria-label="Output">
      <span v-for="(symbol, i) in puzzle.output" :key="`out-${i}`" class="switch-tile">
        <AbilityShape :shape="symbol" :color="switchSymbolColor[symbol]" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.switch-board {
  display: grid;
  justify-items: center;
  gap: 10px;
  width: min(480px, 100%);
  margin: 0 auto;
  padding: 20px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.switch-board.is-stage2 {
  width: min(520px, 100%);
}
.switch-row {
  display: grid;
  grid-template-columns: repeat(4, 52px);
  justify-content: space-between;
  width: 100%;
  max-width: 340px;
}
.switch-tile {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background: #d9dadc;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
}
.switch-funnel {
  width: 48px;
  height: 40px;
  fill: #5f6062;
}
.switch-funnel.is-flipped { transform: rotate(180deg); }
.switch-rail {
  display: flex;
  gap: 8px;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 14px;
  border: 6px solid #e4e5e7;
}
.switch-rail--stage2 {
  flex-wrap: wrap;
  width: 100%;
  gap: 10px;
}
.switch-stage2-row {
  width: 100%;
}
.switch-code {
  flex: 1 1 0;
  min-width: 0;
  padding: 12px 6px;
  border: 2px solid transparent;
  border-radius: 6px;
  background: #d9dadc;
  color: #6b6d70;
  font-size: clamp(0.85rem, 3.4vw, 1.15rem);
  font-weight: 500;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.switch-code:hover:not(:disabled) { background: #cfd0d3; }
.switch-code.is-selected {
  background: #5f6062;
  color: #fff;
}
.switch-code.is-correct {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-dark);
}
.switch-code.is-wrong {
  border-color: var(--danger);
  background: #fee4e2;
  color: var(--danger);
}
.switch-code:disabled { cursor: default; opacity: 1; }

.switch-code-card {
  display: grid;
  gap: 8px;
  justify-items: center;
  min-width: 108px;
  padding: 10px 8px 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: #d9dadc;
  color: #6b6d70;
}
.switch-code-card:hover:not(:disabled) { background: #cfd0d3; }
.switch-code-card.is-selected {
  background: #5f6062;
  color: #fff;
}
.switch-code-card.is-correct {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-dark);
}
.switch-code-card.is-wrong {
  border-color: var(--danger);
  background: #fee4e2;
  color: var(--danger);
}
.switch-code-card:disabled { cursor: default; opacity: 1; }
.switch-code-label {
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.switch-preview {
  display: grid;
  grid-template-columns: repeat(4, 22px);
  gap: 3px;
}
.switch-preview-tile {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: #ececed;
}
.switch-code-card.is-selected .switch-preview-tile {
  background: #78797b;
}
</style>
