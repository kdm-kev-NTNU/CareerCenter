<script setup lang="ts">
import { useAppStore } from "../../stores/app.js";

const appStore = useAppStore();
</script>

<template>
  <div
    v-if="appStore.error"
    class="panel error error-banner"
    role="alert"
    aria-live="assertive"
  >
    <p class="error-banner__message">{{ appStore.error }}</p>
    <button type="button" class="ghost error-banner__dismiss" aria-label="Lukk feilmelding" @click="appStore.clearError">
      Lukk
    </button>
  </div>
</template>
