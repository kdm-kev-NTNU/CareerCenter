<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

const tabs = [
  { to: "/education", label: "Oversikt", end: true },
  { to: "/education/kurs", label: "Kurs" },
  { to: "/education/boker", label: "Bøker" },
  { to: "/education/plattformer", label: "Plattformer" },
  { to: "/education/bachelor", label: "Bachelor-lærdom" },
  { to: "/education/ai", label: "AI-ressurser" }
];
</script>

<template>
  <section class="stack">
    <div class="toolbar">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :end="tab.end"
        custom
        v-slot="{ isActive, navigate }"
      >
        <button type="button" :class="{ active: isActive }" @click="navigate">{{ tab.label }}</button>
      </RouterLink>
    </div>
    <RouterView />
  </section>
</template>
