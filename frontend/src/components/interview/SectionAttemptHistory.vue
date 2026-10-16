<script setup lang="ts">
import type { InterviewMessageDto, SectionAttempt } from "@careercenter/shared";
import { starRubricCriterionLabels, starRubricCriteria } from "@careercenter/shared";
import ChatMessage from "../ui/ChatMessage.vue";
import AppButton from "../ui/AppButton.vue";

const props = defineProps<{
  title: string;
  attempts: readonly SectionAttempt[];
  expandedSessionId: string | null;
  messages: InterviewMessageDto[] | null;
  loadingMessages: boolean;
}>();

const emit = defineEmits<{
  open: [sessionId: string];
  close: [];
}>();

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) return "";
  const sign = delta > 0 ? "+" : "";
  return ` (${sign}${delta})`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

function chatRole(role: string): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function toggle(sessionId: string) {
  if (props.expandedSessionId === sessionId) emit("close");
  else emit("open", sessionId);
}
</script>

<template>
  <section class="attempt-history stack-tight" data-test="section-attempt-history">
    <h3 class="attempt-history__title">{{ title }}</h3>
    <ul class="attempt-history__list plain-list">
      <li v-for="attempt in attempts" :key="attempt.session.id" class="attempt-row">
        <button
          type="button"
          class="attempt-row__toggle"
          :aria-expanded="expandedSessionId === attempt.session.id"
          :data-test="`attempt-row-${attempt.version}`"
          @click="toggle(attempt.session.id)"
        >
          <span class="attempt-row__version">Versjon {{ attempt.version }}</span>
          <span class="attempt-row__meta">
            <template v-if="attempt.session.finishedAt">
              {{ formatDate(attempt.session.finishedAt) }}
            </template>
            <template v-if="attempt.sum !== undefined">
              · sum {{ attempt.sum }}{{ formatDelta(attempt.deltaFromPrevious) }}
            </template>
          </span>
        </button>
        <div
          v-if="expandedSessionId === attempt.session.id"
          class="attempt-row__detail stack-tight"
          :data-test="`attempt-detail-${attempt.version}`"
        >
          <ul v-if="attempt.session.feedback" class="attempt-scores plain-list">
            <li v-for="criterion in starRubricCriteria" :key="criterion">
              {{ starRubricCriterionLabels[criterion] }}:
              {{ attempt.session.feedback.scores[criterion] }}
            </li>
          </ul>
          <p v-if="attempt.session.feedback?.improvement" class="attempt-improvement">
            {{ attempt.session.feedback.improvement }}
          </p>
          <p v-if="loadingMessages" class="field-hint">Laster samtale…</p>
          <div v-else-if="messages" class="stack" data-test="attempt-transcript">
            <ChatMessage
              v-for="message in messages"
              :key="message.id"
              :role="chatRole(message.role)"
              :content="message.content"
            />
            <p v-if="messages.length === 0" class="field-hint">Ingen meldinger lagret.</p>
          </div>
          <AppButton variant="ghost" data-test="attempt-close" @click="emit('close')">Lukk</AppButton>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.attempt-history__title {
  margin: 0;
  font-size: 1rem;
}

.attempt-history__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attempt-row__toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border, #2a3648);
  border-radius: 8px;
  background: var(--surface-strong, #161e2e);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.attempt-row__toggle[aria-expanded="true"] {
  border-color: var(--accent, #3d8bfd);
}

.attempt-row__version {
  font-weight: 600;
}

.attempt-row__meta {
  font-size: 0.9rem;
  opacity: 0.85;
}

.attempt-row__detail {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-left: 3px solid var(--accent, #3d8bfd);
}

.attempt-scores {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.25rem 0.75rem;
  font-size: 0.9rem;
}

.attempt-improvement {
  margin: 0;
  font-size: 0.95rem;
}
</style>
