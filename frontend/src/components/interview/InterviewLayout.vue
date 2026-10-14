<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

const tabs = [
  { to: "/interview", label: "Oversikt", end: true },
  { to: "/interview/bibel", label: "Bibel" },
  { to: "/interview/plan/ny", label: "Ny plan" },
  { to: "/interview/simulator", label: "Simulator" },
  { to: "/interview/video", label: "Video" },
  { to: "/interview/evnetester", label: "Evnetester" },
  { to: "/interview/struktur", label: "Struktur" }
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
