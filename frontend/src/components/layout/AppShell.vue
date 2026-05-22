<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import { useAppStore } from "../../stores/app.js";
import ErrorBanner from "../shared/ErrorBanner.vue";
import Sidebar from "./Sidebar.vue";
import Topbar from "./Topbar.vue";

const appStore = useAppStore();

onMounted(() => {
  void appStore.initialize();
});
</script>

<template>
  <div class="app-shell">
    <Sidebar />
    <section class="content">
      <Topbar />
      <ErrorBanner />
      <RouterView />
    </section>
  </div>
</template>
