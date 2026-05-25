<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const title = computed(() => (route.meta.title as string) ?? "CareerCenter");
</script>

<template>
  <header class="topbar">
    <div>
      <h1>{{ title }}</h1>
    </div>
  </header>
</template>
