<script setup lang="ts">
import { computed } from "vue";
import type { DataSheet } from "@careercenter/shared";

const props = defineProps<{
  sheet: DataSheet;
}>();

const piePaths = computed(() => {
  if (props.sheet.kind !== "pie") return [];
  const slices = props.sheet.slices;
  const cx = 100;
  const cy = 100;
  const r = 80;
  let angle = -Math.PI / 2;
  return slices.map((slice) => {
    const sweep = (slice.percent / 100) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      label: slice.label,
      percent: slice.percent,
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    };
  });
});

const PIE_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];

const barMax = computed(() => {
  if (props.sheet.kind !== "bar") return 1;
  let max = 1;
  for (const s of props.sheet.series) {
    for (const v of s.values) max = Math.max(max, v);
  }
  return max;
});
</script>

<template>
  <article class="data-sheet stack">
    <h4>{{ sheet.title }}</h4>

    <template v-if="sheet.kind === 'table'">
      <p class="field-hint">Enhet: {{ sheet.unitLabel }}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th v-for="col in sheet.columns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sheet.rows" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td v-for="(val, i) in row.values" :key="i">
                {{ val.toLocaleString("nb-NO") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="sheet.kind === 'pie'">
      <p class="field-hint">
        Total produktinntekt: {{ sheet.total.toLocaleString("nb-NO") }}
        {{ sheet.totalUnitLabel }}
      </p>
      <div class="pie-row">
        <svg viewBox="0 0 200 200" class="pie-svg" aria-hidden="true">
          <path
            v-for="(p, i) in piePaths"
            :key="p.label"
            :d="p.d"
            :fill="PIE_COLORS[i % PIE_COLORS.length]"
            stroke="#fff"
            stroke-width="1"
          />
        </svg>
        <ul class="pie-legend">
          <li v-for="(slice, i) in sheet.slices" :key="slice.label">
            <span
              class="swatch"
              :style="{ background: PIE_COLORS[i % PIE_COLORS.length] }"
            />
            {{ slice.label }} — {{ slice.percent }} %
          </li>
        </ul>
      </div>
    </template>

    <template v-else-if="sheet.kind === 'bar'">
      <p class="field-hint">Enhet: {{ sheet.unitLabel }}</p>
      <svg
        class="bar-svg"
        :viewBox="`0 0 ${Math.max(320, sheet.categories.length * 80)} 180`"
        role="img"
      >
        <g v-for="(cat, ci) in sheet.categories" :key="cat">
          <g v-for="(series, si) in sheet.series" :key="series.label">
            <rect
              :x="ci * 80 + 20 + si * (50 / sheet.series.length)"
              :y="160 - (series.values[ci]! / barMax) * 130"
              :width="Math.max(8, 40 / sheet.series.length)"
              :height="(series.values[ci]! / barMax) * 130"
              :fill="PIE_COLORS[si % PIE_COLORS.length]"
            />
          </g>
          <text :x="ci * 80 + 40" y="175" text-anchor="middle" font-size="10">
            {{ cat }}
          </text>
        </g>
      </svg>
      <ul class="pie-legend">
        <li v-for="(series, i) in sheet.series" :key="series.label">
          <span class="swatch" :style="{ background: PIE_COLORS[i % PIE_COLORS.length] }" />
          {{ series.label }}
        </li>
      </ul>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th v-for="cat in sheet.categories" :key="cat">{{ cat }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="series in sheet.series" :key="series.label">
              <th scope="row">{{ series.label }}</th>
              <td v-for="(val, i) in series.values" :key="i">
                {{ val.toLocaleString("nb-NO") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="sheet.kind === 'passage'">
      <p class="passage-text">{{ sheet.text }}</p>
    </template>
  </article>
</template>

<style scoped>
.data-sheet {
  gap: 8px;
}
.data-sheet h4 {
  margin: 0;
  font-size: 1rem;
}
.table-wrap {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.875rem;
}
th,
td {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: right;
}
th:first-child,
td:first-child,
th[scope="row"] {
  text-align: left;
}
.pie-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.pie-svg {
  width: 160px;
  height: 160px;
}
.bar-svg {
  width: 100%;
  max-width: 480px;
  height: auto;
}
.pie-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 0.875rem;
}
.pie-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}
.passage-text {
  margin: 0;
  line-height: 1.55;
  white-space: pre-wrap;
}
</style>
