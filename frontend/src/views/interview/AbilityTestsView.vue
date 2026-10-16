<script setup lang="ts">
import type {
  AbilitySession,
  AbilitySessionReport,
  AbilityTestKind,
  MtaSession,
  MtaSessionReport,
  PuzzleAbilityTestKind,
  ScalesClxPuzzle,
  StatementSession,
  StatementSessionReport,
  SwitchChallengePuzzle
} from "@careercenter/shared";
import {
  VERDICT_LABELS,
  buildSessionReport,
  currentPuzzle,
  finishSession,
  formatSwitchCode,
  generateNumericalReasoning,
  generateScalesMta,
  generateVerbalReasoning,
  isExpired,
  isMtaAbilityKind,
  isPuzzleAbilityKind,
  isStatementAbilityKind,
  recordAnswer,
  remainingMs,
  startMtaSession,
  startSession,
  startStatementSession
} from "@careercenter/shared";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  interviewPrepApi,
  type AonSourcePdfListItem
} from "../../api/interviewPrep.js";
import {
  getAbilityProvider,
  type AbilityProvider
} from "../../components/interview/ability/abilityProviders.js";
import MtaRunner from "../../components/interview/ability/MtaRunner.vue";
import ScalesClxBoard from "../../components/interview/ability/ScalesClxBoard.vue";
import StatementTestRunner from "../../components/interview/ability/StatementTestRunner.vue";
import SwitchChallengeBoard from "../../components/interview/ability/SwitchChallengeBoard.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";

type Mode = "menu" | "playing" | "report";

const route = useRoute();
const provider = computed((): AbilityProvider | undefined => {
  const id = String(route.params.provider ?? "");
  return getAbilityProvider(id);
});

const mode = ref<Mode>("menu");
const session = ref<AbilitySession | null>(null);
const statementSession = ref<StatementSession | null>(null);
const mtaSession = ref<MtaSession | null>(null);
const report = ref<AbilitySessionReport | null>(null);
const statementReport = ref<StatementSessionReport | null>(null);
const mtaReport = ref<MtaSessionReport | null>(null);
const nowMs = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;

const minutesByKind = ref<Record<string, number>>({});

const selectedSwitch = ref<number | null>(null);
const selectedPair = ref<[number | null, number | null]>([null, null]);
const selectedClx = ref<number[]>([]);

const sourcePdfs = ref<AonSourcePdfListItem[]>([]);
const loadingSources = ref(false);
const openingSourceId = ref<string | null>(null);
const sourceError = ref<string | null>(null);

const showSourcePdfs = computed(() => provider.value?.id === "aon");

watch(
  provider,
  (p) => {
    if (!p) return;
    const next: Record<string, number> = { ...minutesByKind.value };
    for (const t of p.tests) {
      if (next[t.kind] == null) next[t.kind] = t.defaultMinutes;
    }
    minutesByKind.value = next;
  },
  { immediate: true }
);

async function loadSourcePdfs() {
  if (!showSourcePdfs.value) return;
  loadingSources.value = true;
  sourceError.value = null;
  try {
    sourcePdfs.value = await interviewPrepApi.aonSourcePdfs();
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : "Kunne ikke laste PDF-samling.";
  } finally {
    loadingSources.value = false;
  }
}

async function openSourcePdf(item: AonSourcePdfListItem) {
  if (!item.available || openingSourceId.value) return;
  openingSourceId.value = item.id;
  sourceError.value = null;
  try {
    await interviewPrepApi.openAonSourcePdf(item.id, item.filename);
  } catch (error) {
    sourceError.value = error instanceof Error ? error.message : "Kunne ikke åpne PDF.";
  } finally {
    openingSourceId.value = null;
  }
}

onMounted(() => {
  void loadSourcePdfs();
});

watch(showSourcePdfs, (show) => {
  if (show && sourcePdfs.value.length === 0 && !loadingSources.value) {
    void loadSourcePdfs();
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
  if (m === "playing" && session.value) startTicker();
  else if (!statementSession.value && !mtaSession.value) stopTicker();
});

function resetSelection() {
  selectedSwitch.value = null;
  selectedPair.value = [null, null];
  selectedClx.value = [];
}

function beginSession(kind: AbilityTestKind) {
  const minutes = Math.min(
    60,
    Math.max(1, Math.round(Number(minutesByKind.value[kind]) || 1))
  );
  minutesByKind.value = { ...minutesByKind.value, [kind]: minutes };

  report.value = null;
  statementReport.value = null;
  mtaReport.value = null;
  resetSelection();

  if (isStatementAbilityKind(kind)) {
    const seed = Date.now() % 1_000_000_000;
    const test =
      kind === "scales_numerical"
        ? generateNumericalReasoning(seed)
        : generateVerbalReasoning(seed);
    statementSession.value = startStatementSession(test, minutes, Date.now());
    session.value = null;
    mtaSession.value = null;
    mode.value = "playing";
    return;
  }

  if (isMtaAbilityKind(kind)) {
    const seed = Date.now() % 1_000_000_000;
    const timeline = generateScalesMta(seed, minutes * 60_000);
    mtaSession.value = startMtaSession(timeline, minutes, Date.now());
    session.value = null;
    statementSession.value = null;
    mode.value = "playing";
    return;
  }

  if (!isPuzzleAbilityKind(kind)) return;
  statementSession.value = null;
  mtaSession.value = null;
  session.value = startSession(kind, minutes, Date.now());
  mode.value = "playing";
}

function endSession() {
  if (!session.value) return;
  session.value = finishSession(session.value);
  report.value = buildSessionReport(session.value);
  mode.value = "report";
}

function onStatementUpdate(next: StatementSession) {
  statementSession.value = next;
}

function onStatementFinish(
  built: StatementSessionReport,
  finished: StatementSession
) {
  statementSession.value = finished;
  statementReport.value = built;
  mode.value = "report";
}

function onMtaUpdate(next: MtaSession) {
  mtaSession.value = next;
}

function onMtaFinish(built: MtaSessionReport, finished: MtaSession) {
  mtaSession.value = finished;
  mtaReport.value = built;
  mode.value = "report";
}

function goMenu() {
  session.value = null;
  statementSession.value = null;
  mtaSession.value = null;
  report.value = null;
  statementReport.value = null;
  mtaReport.value = null;
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
  const kind = session.value.kind as PuzzleAbilityTestKind;
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

  session.value = result.session;
  resetSelection();

  if (result.session.finished || result.session.currentIndex == null) {
    report.value = buildSessionReport(result.session);
    mode.value = "report";
  }
}

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

function kindTitle(kind: AbilityTestKind): string {
  return provider.value?.tests.find((t) => t.kind === kind)?.title ?? kind;
}

const catalogGroups = computed(() => {
  const p = provider.value;
  if (!p) return [];
  const groups: Array<{ key: string; label: string; items: typeof p.catalog }> = [
    { key: "ferdighet", label: "Ferdighetstester", items: [] },
    { key: "logikk", label: "Logikktester", items: [] },
    { key: "personlighet", label: "Personlighetstester", items: [] }
  ];
  for (const item of p.catalog) {
    const g = groups.find((x) => x.key === item.group);
    g?.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
});
</script>

<template>
  <section v-if="provider" class="stack">
    <PageHeader :title="provider.name" :lead="provider.shortDescription">
      <template #meta>
        <RouterLink to="/interview/evnetester" class="field-hint">← Alle aktører</RouterLink>
      </template>
    </PageHeader>

    <template v-if="mode === 'menu'">
      <article class="panel stack aon-guide">
        <h3>Forberedelse</h3>
        <p>
          Offisiell guide:
          <a :href="provider.officialUrl" target="_blank" rel="noopener noreferrer">
            {{ provider.officialUrlLabel }}
          </a>
        </p>
        <h4>Slik er testen bygget</h4>
        <ul>
          <li v-for="(line, i) in provider.howItWorks" :key="i">{{ line }}</li>
        </ul>
        <details class="aon-fold">
          <summary>Øvingstips</summary>
          <ul>
            <li v-for="(line, i) in provider.tips" :key="i">{{ line }}</li>
          </ul>
        </details>
        <details class="aon-fold">
          <summary>Testtyper hos {{ provider.name }}</summary>
          <div v-for="group in catalogGroups" :key="group.key" class="catalog-group">
            <strong>{{ group.label }}</strong>
            <ul>
              <li v-for="item in group.items" :key="item.name">
                {{ item.name }}
                <span class="field-hint">
                  — {{ item.duration }}. {{ item.measures }}
                  <template v-if="item.playableKind"> (kan øves her)</template>
                </span>
              </li>
            </ul>
          </div>
        </details>
      </article>

      <article v-if="showSourcePdfs" class="panel stack aon-pdf-folder">
        <h3>PDF-samling</h3>
        <p class="field-hint">
          Øvings-PDF-ene testene ble laget etter. Verbal resonnering har ingen kilde-PDF.
        </p>
        <p v-if="loadingSources" class="field-hint">Laster PDF-er …</p>
        <p v-else-if="sourceError" class="error-text">{{ sourceError }}</p>
        <ul v-else class="aon-pdf-list">
          <li v-for="item in sourcePdfs" :key="item.id" class="aon-pdf-row">
            <div class="aon-pdf-meta">
              <strong>{{ item.title }}</strong>
              <span class="field-hint">{{ item.filename }}</span>
              <span v-if="!item.available" class="field-hint">Mangler på disk</span>
            </div>
            <AppButton
              variant="secondary"
              :disabled="!item.available || openingSourceId === item.id"
              :loading="openingSourceId === item.id"
              @click="openSourcePdf(item)"
            >
              Åpne
            </AppButton>
          </li>
        </ul>
      </article>

      <div class="module-grid">
        <article v-for="t in provider.tests" :key="t.kind" class="module-card">
          <strong>{{ t.title }}</strong>
          <span>{{ t.description }}</span>
          <label class="ability-minutes">
            Minutter
            <input
              v-model.number="minutesByKind[t.kind]"
              type="number"
              min="1"
              max="60"
            />
          </label>
          <AppButton
            :variant="t.kind === 'switch_challenge' ? undefined : 'secondary'"
            @click="beginSession(t.kind)"
          >
            Start
          </AppButton>
        </article>
      </div>
    </template>

    <StatementTestRunner
      v-else-if="mode === 'playing' && statementSession"
      :session="statementSession"
      :title="kindTitle(statementSession.test.kind)"
      @update="onStatementUpdate"
      @finish="onStatementFinish"
    />

    <MtaRunner
      v-else-if="mode === 'playing' && mtaSession"
      :session="mtaSession"
      :title="kindTitle(mtaSession.timeline.kind)"
      @update="onMtaUpdate"
      @finish="onMtaFinish"
    />

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

    <article v-else-if="mode === 'report' && statementReport" class="panel stack">
      <div class="panel-heading-row">
        <h3>Rapport — {{ kindTitle(statementReport.kind) }}</h3>
        <AppButton variant="ghost" @click="goMenu">Tilbake</AppButton>
      </div>
      <p>
        {{ statementReport.correctCount }} riktige, {{ statementReport.wrongCount }} feil,
        {{ statementReport.unansweredCount }} ubesvarte
        ({{ statementReport.answeredCount }} besvart). Poeng:
        {{ statementReport.score }} (+1 riktig, −1 feil).
      </p>

      <div
        v-for="(item, idx) in statementReport.items"
        :key="item.statement.id"
        class="ability-report-item stack"
      >
        <div class="panel-heading-row">
          <strong>Påstand {{ idx + 1 }}</strong>
          <span
            v-if="item.correct != null"
            :class="item.correct ? 'success-text' : 'error-text'"
          >
            {{ item.correct ? "Riktig" : "Feil" }}
          </span>
          <span v-else class="field-hint">Ubesvart</span>
        </div>
        <p>{{ item.statement.text }}</p>
        <p class="field-hint">
          Ditt svar:
          {{ item.answer ? VERDICT_LABELS[item.answer] : "—" }}
          · Fasit: {{ VERDICT_LABELS[item.statement.verdict] }}
        </p>
        <p class="field-hint">{{ item.statement.rationale }}</p>
      </div>

      <div class="page-header-actions">
        <AppButton @click="goMenu">Til meny</AppButton>
      </div>
    </article>

    <article v-else-if="mode === 'report' && mtaReport" class="panel stack">
      <div class="panel-heading-row">
        <h3>Rapport — {{ kindTitle(mtaReport.kind) }}</h3>
        <AppButton variant="ghost" @click="goMenu">Tilbake</AppButton>
      </div>
      <p>
        Poeng: {{ mtaReport.score }}. Fly: {{ mtaReport.landedCount }} landet,
        {{ mtaReport.missCount }} bom. Regnestykker:
        {{ mtaReport.equationCorrect }} riktige,
        {{ mtaReport.equationWrong }} feil. Bokstaver:
        {{ mtaReport.letterCorrect }} riktige,
        {{ mtaReport.letterWrong }} feil.
      </p>
      <div class="ability-report-item stack">
        <strong>Fly</strong>
        <p class="field-hint">
          Landet teller +1. Bom teller 0. Du flytter det grå feltet selv
          (↑/↓) og klikker flyet når det treffer feltet.
        </p>
      </div>
      <div class="ability-report-item stack">
        <strong>Regnestykker</strong>
        <p class="field-hint">
          {{ mtaReport.equationCorrect }} riktige · {{ mtaReport.equationWrong }} feil
          (+1 / −1).
        </p>
      </div>
      <div class="ability-report-item stack">
        <strong>Bokstaver</strong>
        <p class="field-hint">
          {{ mtaReport.letterCorrect }} riktige · {{ mtaReport.letterWrong }} feil
          (+1 / −1). Correct når en bokstav forekommer to ganger.
        </p>
      </div>
      <div class="page-header-actions">
        <AppButton @click="goMenu">Til meny</AppButton>
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
.aon-guide ul {
  margin: 0;
  padding-left: 1.2rem;
}
.aon-guide h4 {
  margin: 0.5rem 0 0;
}
.aon-fold {
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.aon-fold summary {
  cursor: pointer;
  font-weight: 700;
  list-style: none;
}
.aon-fold summary::-webkit-details-marker {
  display: none;
}
.aon-fold summary::before {
  content: "▸";
  display: inline-block;
  width: 1rem;
  color: var(--muted, #667085);
}
.aon-fold[open] summary::before {
  content: "▾";
}
.aon-fold ul {
  margin-top: 8px;
}
.catalog-group {
  margin-top: 8px;
}
.aon-pdf-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.aon-pdf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.aon-pdf-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
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
