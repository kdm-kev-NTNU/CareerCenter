<script setup lang="ts">
import type { InterviewMessageDto, SectionAttempt } from "@careercenter/shared";
import { starRubricCriterionLabels, starRubricCriteria } from "@careercenter/shared";
import ChatMessage from "../ui/ChatMessage.vue";
import AppButton from "../ui/AppButton.vue";
import { formatScoreDelta } from "./sectionCardView.js";

const props = defineProps<{
  title: string;
  attempts: readonly SectionAttempt[];
  open: boolean;
  expandedSessionId: string | null;
  messages: InterviewMessageDto[] | null;
  loadingMessages: boolean;
  deletingSessionId: string | null;
}>();

const emit = defineEmits<{
  "toggle-open": [];
  open: [sessionId: string];
  close: [];
  delete: [attempt: SectionAttempt];
}>();

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

function attemptCountLabel(count: number): string {
  return count === 1 ? "1 forsøk" : `${count} forsøk`;
}
</script>

<template>
  <section class="attempt-history stack-tight" data-test="section-attempt-history">
    <button
      type="button"
      class="attempt-history__header"
      :aria-expanded="open"
      data-test="attempt-history-toggle"
      @click="emit('toggle-open')"
    >
      <span class="attempt-history__title">
        <span aria-hidden="true">{{ open ? "▾" : "▸" }}</span>
        {{ title }} ({{ attemptCountLabel(attempts.length) }})
      </span>
      <span class="attempt-history__hint">{{ open ? "Skjul" : "Vis" }}</span>
    </button>
    <ul v-if="open" class="attempt-history__list plain-list" data-test="attempt-history-list">
      <li v-for="attempt in attempts" :key="attempt.session.id" class="attempt-row">
        <div class="attempt-row__head" :class="{ 'attempt-row__head--open': expandedSessionId === attempt.session.id }">
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
                · sum {{ attempt.sum }}{{ formatScoreDelta(attempt.deltaFromPrevious) }}
              </template>
            </span>
          </button>
          <button
            type="button"
            class="attempt-row__delete danger"
            :disabled="deletingSessionId !== null"
            :aria-label="`Slett versjon ${attempt.version}`"
            :data-test="`attempt-delete-${attempt.version}`"
            @click="emit('delete', attempt)"
          >
            {{ deletingSessionId === attempt.session.id ? "Sletter …" : "Slett" }}
          </button>
        </div>
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
.attempt-history__header,
.attempt-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: #17202a;
}

.attempt-history__header {
  padding: 0.65rem 0.75rem;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.attempt-history__header[aria-expanded="true"],
.attempt-row__head--open {
  border-color: var(--accent);
}

.attempt-history__title {
  display: inline-flex;
  gap: 0.5rem;
  font-weight: 600;
}

.attempt-history__hint {
  font-size: 0.85rem;
  color: var(--muted);
}

.attempt-history__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attempt-row__head {
  padding: 0.35rem 0.5rem 0.35rem 0;
}

.attempt-row__toggle {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  min-width: 0;
  padding: 0.3rem 0.75rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.attempt-row__version {
  font-weight: 600;
}

.attempt-row__meta {
  font-size: 0.9rem;
  color: var(--muted);
}

.attempt-row__delete {
  flex-shrink: 0;
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
}

.attempt-row__delete:hover:not(:disabled) {
  border-color: var(--danger);
  background: #fef3f2;
}

.attempt-row__detail {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-left: 3px solid var(--accent);
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
