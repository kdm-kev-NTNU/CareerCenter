<script setup lang="ts">
import type {
  AbilitySession,
  AbilitySessionReport,
  InterviewAbilityTestAttemptDto,
  ScalesClxPuzzle,
  SwitchChallengePuzzle
} from "@careercenter/shared";
import {
  buildSessionReport,
  currentPuzzle,
  finishSession,
  formatSwitchCode,
  isExpired,
  recordAnswer,
  remainingMs,
  startSession
} from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import ScalesClxBoard from "../../components/interview/ability/ScalesClxBoard.vue";
import SwitchChallengeBoard from "../../components/interview/ability/SwitchChallengeBoard.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";

type Mode = "menu" | "playing" | "report";

const mode = ref<Mode>("menu");
const session = ref<AbilitySession | null>(null);
const report = ref<AbilitySessionReport | null>(null);
const nowMs = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;

const switchMinutes = ref(6);
const clxMinutes = ref(10);

const selectedSwitch = ref<number | null>(null);
const selectedPair = ref<[number | null, number | null]>([null, null]);
const selectedClx = ref<number[]>([]);

const history = ref<InterviewAbilityTestAttemptDto[]>([]);
const loadingHistory = ref(true);

onMounted(async () => {
  try {
    history.value = await interviewPrepApi.abilityAttempts();
  } finally {
    loadingHistory.value = false;
  }
});

onUnmounted(() => {
  stopTicker();
});

function startTicker() {
  stopTicker();
  nowMs.value = Date.now();
  tickHandle = setInterval(() => {
    nowMs.value = Date.now();
    if (session.value && !session.value.finished && isExpired(session.value, nowMs.value)) {
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

watch(mode, (m) => {
  if (m === "playing") startTicker();
  else stopTicker();
});

async function persistAttempt(
  kind: "switch_challenge" | "scales_clx",
  seed: number,
  correct: boolean,
  durationMs: number
) {
  const attempt = await interviewPrepApi.createAbilityAttempt({
    kind,
    seed,
    correct,
    durationMs
  });
  history.value.unshift(attempt);
}

function resetSelection() {
  selectedSwitch.value = null;
  selectedPair.value = [null, null];
  selectedClx.value = [];
}

function beginSession(kind: "switch_challenge" | "scales_clx") {
  const minutes = kind === "switch_challenge" ? switchMinutes.value : clxMinutes.value;
  const clamped = Math.min(60, Math.max(1, Math.round(Number(minutes) || 1)));
  if (kind === "switch_challenge") switchMinutes.value = clamped;
  else clxMinutes.value = clamped;

  session.value = startSession(kind, clamped, Date.now());
  report.value = null;
  resetSelection();
  mode.value = "playing";
}

function endSession() {
  if (!session.value) return;
  session.value = finishSession(session.value);
  report.value = buildSessionReport(session.value);
  mode.value = "report";
}

function goMenu() {
  session.value = null;
  report.value = null;
  resetSelection();
  mode.value = "menu";
}

const activePuzzle = computed(() => (session.value ? currentPuzzle(session.value) : null));

const switchPuzzle = computed((): SwitchChallengePuzzle | null => {
  const p = activePuzzle.value;
  if (!p || !session.value || session.value.kind !== "switch_challenge") return null;
  return p as SwitchChallengePuzzle;
});

const clxPuzzle = computed((): ScalesClxPuzzle | null => {
  const p = activePuzzle.value;
  if (!p || !session.value || session.value.kind !== "scales_clx") return null;
  return p as ScalesClxPuzzle;
});

const countdownLabel = computed(() => {
  if (!session.value) return "";
  const ms = remainingMs(session.value, nowMs.value);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
});

const canSubmitSwitch = computed(() => {
  const p = switchPuzzle.value;
  if (!p) return false;
  if (p.stage === 1) return selectedSwitch.value != null;
  return selectedPair.value[0] != null && selectedPair.value[1] != null;
});

const canSubmitClx = computed(() => selectedClx.value.length === 2);

function selectSwitch(i: number) {
  selectedSwitch.value = i;
}

function selectSwitchRow(payload: { row: 0 | 1; index: number }) {
  const next: [number | null, number | null] = [...selectedPair.value];
  next[payload.row] = payload.index;
  selectedPair.value = next;
}

function toggleClx(i: number) {
  if (selectedClx.value.includes(i)) {
    selectedClx.value = selectedClx.value.filter((x) => x !== i);
  } else if (selectedClx.value.length < 2) {
    selectedClx.value = [...selectedClx.value, i];
  }
}

function submitCurrent() {
  if (!session.value || session.value.currentIndex == null) return;
  const kind = session.value.kind;
  const current = session.value.items[session.value.currentIndex];
  if (!current) return;

  let answer: number | [number, number] | number[];
  if (kind === "switch_challenge") {
    const puzzle = current.puzzle as SwitchChallengePuzzle;
    if (puzzle.stage === 1) {
      if (selectedSwitch.value == null) return;
      answer = selectedSwitch.value;
    } else {
      const [a, b] = selectedPair.value;
      if (a == null || b == null) return;
      answer = [a, b];
    }
  } else {
    if (selectedClx.value.length !== 2) return;
    answer = [...selectedClx.value];
  }

  const result = recordAnswer(session.value, answer, Date.now());
  if (!result.ok) {
    if (result.reason === "expired") endSession();
    return;
  }

  const answered = result.session.items[session.value.currentIndex]!;
  void persistAttempt(kind, answered.seed, answered.correct === true, answered.durationMs);

  session.value = result.session;
  resetSelection();

  if (result.session.finished || result.session.currentIndex == null) {
    report.value = buildSessionReport(result.session);
    mode.value = "report";
  }
}

function accuracyFor(kind: "switch_challenge" | "scales_clx") {
  const rows = history.value.filter((h) => h.kind === kind);
  if (!rows.length) return null;
  const ok = rows.filter((h) => h.correct).length;
  return { pct: Math.round((ok / rows.length) * 100), n: rows.length };
}

const switchAccuracy = computed(() => accuracyFor("switch_challenge"));
const clxAccuracy = computed(() => accuracyFor("scales_clx"));

function reportSwitchSelection(item: AbilitySessionReport["items"][number]): {
  selectedIndex: number | null;
  selectedPair: [number | null, number | null];
} {
  const puzzle = item.puzzle as SwitchChallengePuzzle;
  if (puzzle.stage === 1) {
    return {
      selectedIndex: typeof item.answer === "number" ? item.answer : null,
      selectedPair: [null, null]
    };
  }
  if (Array.isArray(item.answer) && item.answer.length === 2 && typeof item.answer[0] === "number") {
    return {
      selectedIndex: null,
      selectedPair: [item.answer[0] as number, item.answer[1] as number]
    };
  }
  return { selectedIndex: null, selectedPair: [null, null] };
}

function reportClxSelection(item: AbilitySessionReport["items"][number]): number[] {
  if (Array.isArray(item.answer) && item.answer.every((x) => typeof x === "number")) {
    return item.answer as number[];
  }
  return [];
}

function asSwitchPuzzle(item: AbilitySessionReport["items"][number]): SwitchChallengePuzzle {
  return item.puzzle as SwitchChallengePuzzle;
}

function asClxPuzzle(item: AbilitySessionReport["items"][number]): ScalesClxPuzzle {
  return item.puzzle as ScalesClxPuzzle;
}

function correctSwitchLabel(item: AbilitySessionReport["items"][number]): string {
  const puzzle = asSwitchPuzzle(item);
  if (puzzle.stage === 1) {
    return formatSwitchCode(puzzle.options[puzzle.correctIndex]!);
  }
  const upper = puzzle.rows[0].options[puzzle.correctPair[0]]!;
  const lower = puzzle.rows[1].options[puzzle.correctPair[1]]!;
  return `${formatSwitchCode(upper)} deretter ${formatSwitchCode(lower)}`;
}
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Evnetester"
      lead="Switch Challenge og Scales CLX, satt opp som i Aon-øvingsoppgavene."
    >
      <template #meta>
        <p v-if="loadingHistory" class="field-hint">Laster historikk …</p>
        <template v-else>
          <p class="field-hint">
            Switch Challenge:
            <template v-if="switchAccuracy">{{ switchAccuracy.pct }}% ({{ switchAccuracy.n }} forsøk)</template>
            <template v-else>ingen forsøk</template>
          </p>
          <p class="field-hint">
            Scales CLX:
            <template v-if="clxAccuracy">{{ clxAccuracy.pct }}% ({{ clxAccuracy.n }} forsøk)</template>
            <template v-else>ingen forsøk</template>
          </p>
        </template>
      </template>
    </PageHeader>

    <div v-if="mode === 'menu'" class="module-grid">
      <article class="module-card">
        <strong>Switch Challenge</strong>
        <span>Deduktiv: finn koden som gjør input om til output. Vanskelighetsgraden øker for hvert riktige svar.</span>
        <label class="ability-minutes">
          Minutter
          <input v-model.number="switchMinutes" type="number" min="1" max="60" />
        </label>
        <AppButton @click="beginSession('switch_challenge')">Start</AppButton>
      </article>
      <article class="module-card">
        <strong>Scales CLX</strong>
        <span>Induktiv: finn regelen og velg de to rutenettene som følger den.</span>
        <label class="ability-minutes">
          Minutter
          <input v-model.number="clxMinutes" type="number" min="1" max="60" />
        </label>
        <AppButton variant="secondary" @click="beginSession('scales_clx')">Start</AppButton>
      </article>
    </div>

    <article v-else-if="mode === 'playing' && session && switchPuzzle" class="panel stack">
      <div class="panel-heading-row">
        <h3>Switch Challenge</h3>
        <div class="ability-session-meta">
          <span class="field-hint">Nivå {{ session.level }}</span>
          <span class="ability-timer" aria-live="polite">{{ countdownLabel }}</span>
          <AppButton variant="ghost" @click="endSession">Avslutt</AppButton>
        </div>
      </div>
      <p class="field-hint">
        <template v-if="switchPuzzle.stage === 1">
          Velg koden som gjør figurene øverst om til figurene nederst. 1-2-3-4 betyr ingen endring.
        </template>
        <template v-else>
          Velg én kode i hver rad. Den nedre koden brukes på resultatet av den øvre. Forhåndsvisningene er konstante.
        </template>
      </p>
      <SwitchChallengeBoard
        :puzzle="switchPuzzle"
        :selected-index="selectedSwitch"
        :selected-pair="selectedPair"
        :revealed="false"
        @select="selectSwitch"
        @select-row="selectSwitchRow"
      />
      <div class="page-header-actions">
        <AppButton :disabled="!canSubmitSwitch" @click="submitCurrent">Neste</AppButton>
      </div>
    </article>

    <article v-else-if="mode === 'playing' && session && clxPuzzle" class="panel stack">
      <div class="panel-heading-row">
        <h3>Scales CLX</h3>
        <div class="ability-session-meta">
          <span class="ability-timer" aria-live="polite">{{ countdownLabel }}</span>
          <AppButton variant="ghost" @click="endSession">Avslutt</AppButton>
        </div>
      </div>
      <p class="field-hint">Det er alltid nøyaktig to rutenett til høyre som følger regelen.</p>
      <ScalesClxBoard
        :puzzle="clxPuzzle"
        :selected="selectedClx"
        :revealed="false"
        @toggle="toggleClx"
      />
      <div class="page-header-actions">
        <AppButton :disabled="!canSubmitClx" @click="submitCurrent">Neste</AppButton>
      </div>
    </article>

    <article v-else-if="mode === 'report' && report" class="panel stack">
      <div class="panel-heading-row">
        <h3>
          Rapport —
          {{ report.kind === "switch_challenge" ? "Switch Challenge" : "Scales CLX" }}
        </h3>
        <AppButton variant="ghost" @click="goMenu">Tilbake</AppButton>
      </div>
      <p>
        {{ report.correctCount }} riktige, {{ report.wrongCount }} feil
        ({{ report.answeredCount }} besvart).
        <template v-if="report.kind === 'switch_challenge'">
          Høyeste nivå: {{ report.peakLevel }}.
        </template>
      </p>

      <div
        v-for="(item, idx) in report.items"
        :key="`${item.seed}-${idx}`"
        class="ability-report-item stack"
      >
        <div class="panel-heading-row">
          <strong>Oppgave {{ idx + 1 }}</strong>
          <span :class="item.correct ? 'success-text' : 'error-text'">
            {{ item.correct ? "Riktig" : "Feil" }}
            <template v-if="report.kind === 'switch_challenge'"> · nivå {{ item.level }}</template>
          </span>
        </div>

        <template v-if="report.kind === 'switch_challenge'">
          <SwitchChallengeBoard
            :puzzle="asSwitchPuzzle(item)"
            :selected-index="reportSwitchSelection(item).selectedIndex"
            :selected-pair="reportSwitchSelection(item).selectedPair"
            :revealed="true"
          />
          <p class="field-hint">
            {{ asSwitchPuzzle(item).stage === 1 ? "Riktig kode:" : "Riktig par:" }}
            {{ correctSwitchLabel(item) }}
          </p>
        </template>

        <template v-else>
          <ScalesClxBoard
            :puzzle="asClxPuzzle(item)"
            :selected="reportClxSelection(item)"
            :revealed="true"
          />
        </template>
      </div>

      <div class="page-header-actions">
        <AppButton @click="goMenu">Til meny</AppButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.ability-minutes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
  color: var(--muted, #667085);
}
.ability-minutes input {
  width: 5rem;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
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
.ability-report-item {
  padding: 16px 0;
  border-top: 1px solid var(--border);
}
</style>
