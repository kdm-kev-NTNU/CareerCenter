<script setup lang="ts">
withDefaults(
  defineProps<{
    state: "loading" | "empty" | "error";
    message?: string;
  }>(),
  {
    message: undefined
  }
);

const defaults: Record<"loading" | "empty" | "error", string> = {
  loading: "Laster …",
  empty: "Ingen treff.",
  error: "Noe gikk galt."
};
</script>

<template>
  <div class="state-view" :class="`state-view--${state}`" role="status">
    <p :class="state === 'error' ? 'error-text' : 'state-view-message'">
      {{ message ?? defaults[state] }}
    </p>
    <slot />
  </div>
</template>
