<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AppModal from "./listing/AppModal.vue";

const props = defineProps<{
  open: boolean;
  title: string;
  notes: string;
  saving?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [notes: string];
}>();

const draft = ref(props.notes);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = props.notes;
      void nextTick(() => textareaRef.value?.focus());
    }
  }
);

watch(
  () => props.notes,
  (notes) => {
    if (props.open) draft.value = notes;
  }
);

function submit() {
  emit("save", draft.value.trim());
}
</script>

<template>
  <AppModal :open="open" :title="title" size="sm" :resizable="false" @close="emit('close')">
    <form class="notes-edit-form" @submit.prevent="submit">
      <label class="wide-field">
        Notater
        <textarea
          ref="textareaRef"
          v-model="draft"
          rows="6"
          placeholder="Skriv notater …"
          :disabled="saving"
        />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <button type="button" class="secondary" :disabled="saving" @click="emit('close')">Avbryt</button>
      <button type="button" class="primary" :disabled="saving" @click="submit">
        {{ saving ? "Lagrer …" : "Lagre" }}
      </button>
    </template>
  </AppModal>
</template>
