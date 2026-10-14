<script setup lang="ts">
import type { SwitchChallengePuzzle } from "@careercenter/shared";
import AbilityShape from "./AbilityShape.vue";
import { switchSymbolColor } from "./abilityPalette.js";

defineProps<{
  puzzle: SwitchChallengePuzzle;
  selectedIndex: number | null;
  revealed: boolean;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();
</script>

<template>
  <div class="switch-board">
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

    <div class="switch-rail">
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
  width: min(420px, 100%);
  margin: 0 auto;
  padding: 20px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
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
  gap: 12px;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 14px;
  border: 6px solid #e4e5e7;
}
.switch-code {
  min-width: 72px;
  padding: 10px 12px;
  border: 2px solid transparent;
  border-radius: 6px;
  background: #d9dadc;
  color: #6b6d70;
  font-size: 1.15rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
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
</style>
