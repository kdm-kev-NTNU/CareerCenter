<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_WIDTHS: Record<ModalSize, number> = {
  sm: 480,
  md: 560,
  lg: 780,
  xl: 960
};

const MIN_WIDTH = 400;
const MAX_WIDTH = 1200;

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    size?: ModalSize;
    resizable?: boolean;
    persistKey?: string;
  }>(),
  {
    size: "lg",
    resizable: true
  }
);

const emit = defineEmits<{
  close: [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const widthPx = ref<number | null>(null);

const defaultWidth = computed(() => SIZE_WIDTHS[props.size]);

const panelStyle = computed(() => ({
  width: `min(${widthPx.value ?? defaultWidth.value}px, 100%)`
}));

function loadPersistedWidth() {
  if (!props.persistKey) return;
  const saved = localStorage.getItem(`careercenter:modal-width:${props.persistKey}`);
  if (!saved) return;
  const parsed = Number(saved);
  if (Number.isFinite(parsed)) {
    widthPx.value = clampWidth(parsed);
  }
}

function clampWidth(width: number) {
  const max = Math.min(MAX_WIDTH, window.innerWidth - 48);
  return Math.max(MIN_WIDTH, Math.min(width, max));
}

function persistWidth() {
  if (!props.persistKey || widthPx.value == null) return;
  localStorage.setItem(`careercenter:modal-width:${props.persistKey}`, String(widthPx.value));
}

function onResizeStart(event: PointerEvent) {
  if (!props.resizable || !panelRef.value) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture(event.pointerId);

  const startX = event.clientX;
  const startWidth = panelRef.value.offsetWidth;

  function onMove(moveEvent: PointerEvent) {
    widthPx.value = clampWidth(startWidth + (moveEvent.clientX - startX));
  }

  function onEnd() {
    handle.releasePointerCapture(event.pointerId);
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onEnd);
    handle.removeEventListener("pointercancel", onEnd);
    persistWidth();
  }

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onEnd);
  handle.addEventListener("pointercancel", onEnd);
}

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
    if (isOpen) loadPersistedWidth();
  }
);

watch(
  () => props.persistKey,
  () => {
    widthPx.value = null;
    loadPersistedWidth();
  }
);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  loadPersistedWidth();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" role="presentation" @click="onOverlayClick">
      <div
        ref="panelRef"
        class="modal-panel"
        :class="[`modal-panel--${size}`, { 'modal-panel--resizable': resizable }]"
        :style="panelStyle"
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
        <div
          v-if="resizable"
          class="modal-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Dra for å endre bredde på dialogen"
          tabindex="0"
          @pointerdown="onResizeStart"
        />
      </div>
    </div>
  </Teleport>
</template>
