<script setup lang="ts">
import type {
  MtaBinaryAnswer,
  MtaSession,
  MtaSessionReport
} from "@careercenter/shared";
import {
  MTA_GATE_HALF_HEIGHT,
  MTA_GATE_STEP,
  MTA_RUNWAY_X,
  aircraftProgress,
  aircraftX,
  answerEquation,
  answerLetters,
  buildMtaReport,
  clickAircraft,
  currentAircraft,
  currentEquation,
  currentLetterChain,
  finishMtaSession,
  formatMtaEquation,
  isMtaExpired,
  moveGate,
  mtaRemainingMs,
  resolveMissedAircraft,
  setGateCenter
} from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AppButton from "../../ui/AppButton.vue";

const props = defineProps<{
  session: MtaSession;
  title: string;
}>();

const emit = defineEmits<{
  update: [session: MtaSession];
  finish: [report: MtaSessionReport, session: MtaSession];
}>();

const nowMs = ref(Date.now());
const skyEl = ref<HTMLElement | null>(null);
let tickHandle: ReturnType<typeof setInterval> | null = null;
let finishing = false;

const equation = computed(() => currentEquation(props.session));
const letterChain = computed(() => currentLetterChain(props.session));
const activeAircraft = computed(() => currentAircraft(props.session, nowMs.value));

const offsetMs = computed(() => Math.max(0, nowMs.value - props.session.startedAt));

const aircraftStyle = computed(() => {
  const ac = activeAircraft.value;
  if (!ac) return null;
  const progress = aircraftProgress(ac, offsetMs.value);
  if (progress == null) return null;
  return {
    left: `${aircraftX(progress) * 100}%`,
    top: `${ac.height * 100}%`
  };
});

const gateStyle = computed(() => ({
  top: `${(props.session.gateCenter - MTA_GATE_HALF_HEIGHT) * 100}%`,
  height: `${MTA_GATE_HALF_HEIGHT * 2 * 100}%`
}));

const runwayLeft = `${MTA_RUNWAY_X * 100}%`;

const minutesToGo = computed(() => {
  const ms = mtaRemainingMs(props.session, nowMs.value);
  return Math.max(0, Math.ceil(ms / 60_000));
});

const progressPct = computed(() => {
  if (props.session.durationMs <= 0) return 100;
  const elapsed = Math.min(props.session.durationMs, offsetMs.value);
  return (elapsed / props.session.durationMs) * 100;
});

function startTicker() {
  stopTicker();
  nowMs.value = Date.now();
  tickHandle = setInterval(() => {
    nowMs.value = Date.now();
    if (props.session.finished || finishing) return;

    const withMisses = resolveMissedAircraft(props.session, nowMs.value);
    if (withMisses.aircraftJudgments.length !== props.session.aircraftJudgments.length) {
      emit("update", withMisses);
    }

    if (isMtaExpired(props.session, nowMs.value)) {
      endSession();
    }
  }, 50);
}

function stopTicker() {
  if (tickHandle != null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (props.session.finished || finishing) return;
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  if (event.key === "ArrowUp") {
    event.preventDefault();
    nudgeGate(-MTA_GATE_STEP);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    nudgeGate(MTA_GATE_STEP);
  }
}

onMounted(() => {
  startTicker();
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  stopTicker();
  window.removeEventListener("keydown", onKeyDown);
});

watch(
  () => props.session.finished,
  (finished) => {
    if (finished) stopTicker();
  }
);

function endSession() {
  if (finishing || props.session.finished) return;
  finishing = true;
  stopTicker();
  const finished = finishMtaSession(props.session, Date.now());
  const report = buildMtaReport(finished);
  emit("finish", report, finished);
}

function nudgeGate(delta: number) {
  const result = moveGate(props.session, delta, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}

function onRunwayClick(event: MouseEvent) {
  const el = skyEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.height <= 0) return;
  const y = (event.clientY - rect.top) / rect.height;
  const result = setGateCenter(props.session, y, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}

function onAircraftClick() {
  const result = clickAircraft(props.session, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}

function onEquation(answer: MtaBinaryAnswer) {
  const result = answerEquation(props.session, answer, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}

function onLetters(answer: MtaBinaryAnswer) {
  const result = answerLetters(props.session, answer, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }
  emit("update", result.session);
}
</script>

<template>
  <article class="panel stack mta-runner">
    <div class="panel-heading-row">
      <h3>{{ title }}</h3>
      <div class="ability-session-meta">
        <AppButton variant="ghost" @click="endSession">Avslutt</AppButton>
      </div>
    </div>
    <p class="field-hint">
      Flytt det grå feltet med ↑ / ↓ eller knapper (eller klikk på stolpen). Klikk flyet når det
      treffer feltet.
    </p>

    <div class="mta-layout">
      <div ref="skyEl" class="mta-sky" aria-label="Aircraft task">
        <div
          class="mta-runway"
          :style="{ left: runwayLeft }"
          role="slider"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="Math.round(session.gateCenter * 100)"
          aria-label="Landing gate"
          tabindex="0"
          @click="onRunwayClick"
        >
          <div class="mta-gate" :style="gateStyle" />
        </div>
        <button
          v-if="aircraftStyle"
          type="button"
          class="mta-aircraft"
          :style="aircraftStyle"
          aria-label="Land aircraft"
          @click.stop="onAircraftClick"
        >
          <svg viewBox="0 0 64 24" width="56" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M2 14 L22 14 L28 4 L34 4 L30 14 L46 14 L52 8 L58 8 L54 14 L62 14 L62 16 L54 16 L58 20 L52 20 L46 16 L30 16 L34 22 L28 22 L22 16 L2 16 Z"
            />
          </svg>
        </button>
        <div class="mta-gate-controls">
          <button type="button" class="mta-gate-btn" aria-label="Flytt feltet opp" @click="nudgeGate(-MTA_GATE_STEP)">
            ↑
          </button>
          <button type="button" class="mta-gate-btn" aria-label="Flytt feltet ned" @click="nudgeGate(MTA_GATE_STEP)">
            ↓
          </button>
        </div>
      </div>

      <div class="mta-side stack">
        <div class="mta-card stack">
          <p class="mta-prompt" aria-live="polite">
            {{ equation ? formatMtaEquation(equation) : "—" }}
          </p>
          <div class="mta-buttons">
            <button
              type="button"
              class="mta-btn"
              :disabled="!equation"
              @click="onEquation('correct')"
            >
              correct
            </button>
            <button
              type="button"
              class="mta-btn"
              :disabled="!equation"
              @click="onEquation('wrong')"
            >
              wrong
            </button>
          </div>
        </div>

        <div class="mta-card stack">
          <p class="mta-prompt mta-letters" aria-live="polite">
            {{ letterChain ? letterChain.letters.join(" ") : "—" }}
          </p>
          <div class="mta-buttons">
            <button
              type="button"
              class="mta-btn"
              :disabled="!letterChain"
              @click="onLetters('correct')"
            >
              correct
            </button>
            <button
              type="button"
              class="mta-btn"
              :disabled="!letterChain"
              @click="onLetters('wrong')"
            >
              wrong
            </button>
          </div>
        </div>
      </div>

      <aside class="mta-timer" aria-live="polite">
        <strong>{{ minutesToGo }} minute(s) to go</strong>
        <div class="mta-timer-track" role="progressbar" :aria-valuenow="progressPct">
          <div class="mta-timer-fill" :style="{ width: `${progressPct}%` }" />
        </div>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.mta-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.9fr) 120px;
  gap: 12px;
  min-height: 360px;
  align-items: stretch;
}
.mta-sky {
  position: relative;
  background: #f7f8fa;
  border: 1px solid var(--border, #d0d5dd);
  border-radius: 8px;
  overflow: hidden;
  min-height: 320px;
}
.mta-runway {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28px;
  margin-left: -14px;
  background: #3f3f46;
  cursor: ns-resize;
  border: none;
  padding: 0;
}
.mta-gate {
  position: absolute;
  left: 0;
  right: 0;
  background: #9ca3af;
  border-top: 2px dashed #fff;
  border-bottom: 2px dashed #fff;
  box-sizing: border-box;
  pointer-events: none;
}
.mta-gate-controls {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mta-gate-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #c4c4c4;
  border-radius: 4px;
  background: #e8e8e8;
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
}
.mta-gate-btn:hover {
  background: #ddd;
}
.mta-aircraft {
  position: absolute;
  transform: translate(-50%, -50%);
  border: none;
  background: transparent;
  color: #111;
  cursor: pointer;
  padding: 4px;
  line-height: 0;
  z-index: 1;
}
.mta-aircraft:hover {
  color: #ea580c;
}
.mta-side {
  gap: 12px;
}
.mta-card {
  flex: 1;
  background: #fff;
  border: 1px solid var(--border, #d0d5dd);
  border-radius: 8px;
  padding: 16px;
  justify-content: center;
  gap: 16px;
}
.mta-prompt {
  margin: 0;
  text-align: center;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.mta-letters {
  letter-spacing: 0.12em;
}
.mta-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.mta-btn {
  min-width: 96px;
  padding: 10px 14px;
  border: 1px solid #c4c4c4;
  border-radius: 4px;
  background: #e8e8e8;
  color: #222;
  font-size: 0.95rem;
  cursor: pointer;
}
.mta-btn:hover:not(:disabled) {
  background: #ddd;
}
.mta-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.mta-timer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
  font-size: 0.9rem;
}
.mta-timer-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.mta-timer-fill {
  height: 100%;
  background: #ea580c;
  transition: width 0.2s linear;
}
.ability-session-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}
@media (max-width: 800px) {
  .mta-layout {
    grid-template-columns: 1fr;
  }
  .mta-timer {
    order: -1;
  }
}
</style>
