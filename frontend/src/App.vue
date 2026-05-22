<script setup lang="ts">
import { RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth.js";

const authStore = useAuthStore();
</script>

<template>
  <div v-if="authStore.loading" class="auth-shell">
    <p class="lead">Laster…</p>
  </div>
  <RouterView v-else />
</template>
