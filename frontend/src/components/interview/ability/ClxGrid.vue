<script setup lang="ts">
import type { ClxGrid } from "@careercenter/shared";
import AbilityShape from "./AbilityShape.vue";
import { clxColorHex, clxShapeKind } from "./abilityPalette.js";

defineProps<{
  grid: ClxGrid;
}>();
</script>

<template>
  <div class="clx-grid" role="img" :aria-label="grid.map((c) => c.shape).join(', ')">
    <span v-for="(item, i) in grid" :key="i" class="clx-cell">
      <AbilityShape :shape="clxShapeKind[item.shape]" :color="clxColorHex[item.color]" :size="18" />
    </span>
  </div>
</template>

<style scoped>
.clx-grid {
  display: grid;
  grid-template-columns: repeat(3, 24px);
  grid-template-rows: repeat(3, 24px);
  border: 1px solid #c9cbcf;
  background: #c9cbcf;
  gap: 1px;
}
.clx-cell {
  display: grid;
  place-items: center;
  background: #fff;
}
</style>
