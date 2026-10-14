<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost";
    type?: "button" | "submit" | "reset";
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    type: "button",
    loading: false,
    disabled: false
  }
);
</script>

<template>
  <button
    :type="type"
    :class="[variant, { 'is-loading': loading }]"
    :disabled="disabled || loading"
  >
    <slot>{{ loading ? "Laster …" : "" }}</slot>
  </button>
</template>
