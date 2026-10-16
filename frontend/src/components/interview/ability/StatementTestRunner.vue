<script setup lang="ts">
import type {
  StatementSession,
  StatementSessionReport,
  StatementVerdict
} from "@careercenter/shared";
import {
  VERDICT_LABELS,
  answerStatement,
  buildStatementReport,
  currentStatement,
  finishStatementSession,
  isStatementExpired,
  navigateStatement,
  sheetForStatement,
  statementRemainingMs
} from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppButton from "../../ui/AppButton.vue";
import DataSheetView from "./DataSheetView.vue";

const props = defineProps<{
  session: StatementSession;
  title: string;
}>();

const emit = defineEmits<{
  update: [session: StatementSession];
  finish: [report: StatementSessionReport, session: StatementSession];
}>();

const nowMs = ref(Date.now());
const openStartedAt = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;

const statement = computed(() => currentStatement(props.session));
const activeSheet = computed(() => {
  const s = statement.value;
  if (!s) return null;
  return sheetForStatement(props.session.test, s);
});

const countdownLabel = computed(() => {
  const ms = statementRemainingMs(props.session, nowMs.value);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
});

const currentAnswer = computed((): StatementVerdict | null => {
  const s = statement.value;
  if (!s) return null;
  return props.session.answers[s.id] ?? null;
});

function startTicker() {
  stopTicker();
  nowMs.value = Date.now();
  tickHandle = setInterval(() => {
    nowMs.value = Date.now();
    if (
      !props.session.finished &&
      isStatementExpired(props.session, nowMs.value)
    ) {
      endSession();
    }
  }, 250);
}

function stopTicker() {
  if (tickHandle != null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

onMounted(() => {
  openStartedAt.value = Date.now();
  startTicker();
});

onUnmounted(() => stopTicker());

watch(
  () => props.session.finished,
  (finished) => {
    if (finished) stopTicker();
  }
);

function selectVerdict(verdict: StatementVerdict) {
  const s = statement.value;
  if (!s) return;
  const result = answerStatement(props.session, s.id, verdict, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}

function goTo(index: number) {
  const result = navigateStatement(
    props.session,
    index,
    Date.now(),
    openStartedAt.value
  );
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  openStartedAt.value = Date.now();
  emit("update", result.session);
}

function goToSheet(sheetId: string) {
  const idx = props.session.test.statements.findIndex((st) => st.sheetId === sheetId);
  if (idx >= 0) goTo(idx);
}

function endSession() {
  const finished = finishStatementSession(
    props.session,
    Date.now(),
    openStartedAt.value
  );
  const report = buildStatementReport(finished);
  stopTicker();
  emit("finish", report, finished);
}

const verdicts: StatementVerdict[] = ["true", "false", "cannot_say"];
</script>

<template>
  <article class="panel stack statement-runner">
    <div class="panel-heading-row">
      <h3>{{ title }}</h3>
      <div class="ability-session-meta">
        <span class="field-hint">
          Påstand {{ session.currentStatementIndex + 1 }} /
          {{ session.test.statements.length }}
        </span>
        <span class="ability-timer" aria-live="polite">{{ countdownLabel }}</span>
        <AppButton variant="ghost" @click="endSession">Avslutt</AppButton>
      </div>
    </div>

    <p class="field-hint">
      Hver påstand gjelder ett dataark. Velg Sant, Usant eller Kan ikke avgjøres.
      Du kan bla fritt og endre svar til tiden er ute.
    </p>

    <div class="statement-layout">
      <div class="statement-sheets stack">
        <div class="sheet-tabs" role="tablist">
          <button
            v-for="sheet in session.test.sheets"
            :key="sheet.id"
            type="button"
            role="tab"
            class="sheet-tab"
            :class="{
              active: activeSheet?.id === sheet.id,
              related: statement?.sheetId === sheet.id
            }"
            @click="goToSheet(sheet.id)"
          >
            {{ sheet.title }}
          </button>
        </div>
        <DataSheetView v-if="activeSheet" :sheet="activeSheet" />
      </div>

      <div class="statement-panel stack">
        <p v-if="statement" class="statement-text">{{ statement.text }}</p>
        <div class="verdict-row">
          <AppButton
            v-for="v in verdicts"
            :key="v"
            :variant="currentAnswer === v ? undefined : 'secondary'"
            @click="selectVerdict(v)"
          >
            {{ VERDICT_LABELS[v] }}
          </AppButton>
        </div>

        <div class="statement-nav">
          <AppButton
            variant="ghost"
            :disabled="session.currentStatementIndex <= 0"
            @click="goTo(session.currentStatementIndex - 1)"
          >
            Forrige
          </AppButton>
          <AppButton
            variant="ghost"
            :disabled="
              session.currentStatementIndex >= session.test.statements.length - 1
            "
            @click="goTo(session.currentStatementIndex + 1)"
          >
            Neste
          </AppButton>
        </div>

        <div class="statement-dots" role="list">
          <button
            v-for="(st, idx) in session.test.statements"
            :key="st.id"
            type="button"
            role="listitem"
            class="dot"
            :class="{
              current: idx === session.currentStatementIndex,
              answered: session.answers[st.id] != null
            }"
            :title="`Påstand ${idx + 1}`"
            @click="goTo(idx)"
          >
            {{ idx + 1 }}
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.statement-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 20px;
}
@media (max-width: 900px) {
  .statement-layout {
    grid-template-columns: 1fr;
  }
}
.sheet-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sheet-tab {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.8rem;
  cursor: pointer;
}
.sheet-tab.active,
.sheet-tab.related {
  border-color: var(--accent);
  font-weight: 600;
}
.statement-text {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.5;
}
.verdict-row,
.statement-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.statement-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}
.dot {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.7rem;
  cursor: pointer;
}
.dot.answered {
  background: #ecfdf3;
  border-color: #abefc6;
}
.dot.current {
  border-color: var(--accent);
  font-weight: 700;
}
.ability-session-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ability-timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: 0.04em;
}
</style>
