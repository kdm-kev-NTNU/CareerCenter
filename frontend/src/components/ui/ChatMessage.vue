<script setup lang="ts">
defineProps<{
  role: "user" | "assistant";
  content: string;
}>();
</script>

<template>
  <div class="chat-message" :class="`chat-message--${role}`">
    <span class="chat-message-role">{{ role === "user" ? "Du" : "Intervjuer" }}</span>
    <p class="chat-message-content">{{ content }}</p>
  </div>
</template>
