<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.open) emit("close");
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit("close");
}

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }
);

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" role="presentation" @click="onOverlayClick">
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
        @click.stop
      >
        <header class="modal-header">
          <h2 id="modal-title">{{ title }}</h2>
          <button type="button" class="modal-close" aria-label="Lukk" @click="emit('close')">×</button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
