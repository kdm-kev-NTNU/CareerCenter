<script setup lang="ts">
import { useAppStore } from "../../stores/app.js";

const appStore = useAppStore();
</script>

<template>
  <p v-if="appStore.error" class="panel error">{{ appStore.error }}</p>
</template>
