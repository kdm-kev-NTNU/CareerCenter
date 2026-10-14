<script setup lang="ts">
import type { InterviewAbilityTestAttemptDto } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import {
  generateScalesClx,
  generateSwitchChallenge,
  isCorrectClxSelection,
  isCorrectSwitchAnswer,
  type ScalesClxPuzzle,
  type SwitchChallengePuzzle
} from "@careercenter/shared";
import ScalesClxBoard from "../../components/interview/ability/ScalesClxBoard.vue";
import SwitchChallengeBoard from "../../components/interview/ability/SwitchChallengeBoard.vue";
import AppButton from "../../components/ui/AppButton.vue";
import PageHeader from "../../components/ui/PageHeader.vue";

const mode = ref<"menu" | "switch" | "clx">("menu");
const seed = ref(Math.floor(Math.random() * 1_000_000));
const switchPuzzle = ref<SwitchChallengePuzzle | null>(null);
const clxPuzzle = ref<ScalesClxPuzzle | null>(null);
const selectedSwitch = ref<number | null>(null);
const selectedClx = ref<number[]>([]);
const revealed = ref(false);
const lastCorrect = ref<boolean | null>(null);
const history = ref<InterviewAbilityTestAttemptDto[]>([]);
const startedAt = ref(0);
const loadingHistory = ref(true);

onMounted(async () => {
  try {
    history.value = await interviewPrepApi.abilityAttempts();
  } finally {
    loadingHistory.value = false;
  }
});

async function persistAttempt(kind: "switch_challenge" | "scales_clx", correct: boolean) {
  const attempt = await interviewPrepApi.createAbilityAttempt({
    kind,
    seed: seed.value,
    correct,
    durationMs: Date.now() - startedAt.value
  });
  history.value.unshift(attempt);
}

function resetRound() {
  seed.value = Math.floor(Math.random() * 1_000_000);
  revealed.value = false;
  lastCorrect.value = null;
  startedAt.value = Date.now();
}

function startSwitch() {
  resetRound();
  switchPuzzle.value = generateSwitchChallenge(seed.value);
  selectedSwitch.value = null;
  mode.value = "switch";
}

function startClx() {
  resetRound();
  clxPuzzle.value = generateScalesClx(seed.value);
  selectedClx.value = [];
  mode.value = "clx";
}

function selectSwitch(i: number) {
  if (revealed.value) return;
  selectedSwitch.value = i;
}

function submitSwitch() {
  if (!switchPuzzle.value || selectedSwitch.value == null) return;
  const correct = isCorrectSwitchAnswer(switchPuzzle.value, selectedSwitch.value);
  revealed.value = true;
  lastCorrect.value = correct;
  void persistAttempt("switch_challenge", correct);
}

function toggleClx(i: number) {
  if (revealed.value) return;
  if (selectedClx.value.includes(i)) {
    selectedClx.value = selectedClx.value.filter((x) => x !== i);
  } else if (selectedClx.value.length < 2) {
    selectedClx.value = [...selectedClx.value, i];
  }
}

function submitClx() {
  if (!clxPuzzle.value) return;
  const correct = isCorrectClxSelection(clxPuzzle.value, selectedClx.value);
  revealed.value = true;
  lastCorrect.value = correct;
  void persistAttempt("scales_clx", correct);
}

const accuracy = computed(() => {
  if (!history.value.length) return null;
  const ok = history.value.filter((h) => h.correct).length;
  return Math.round((ok / history.value.length) * 100);
});
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Evnetester"
      lead="Switch Challenge og Scales CLX, satt opp som i Aon-øvingsoppgavene."
    >
      <template #meta>
        <p v-if="loadingHistory" class="field-hint">Laster historikk …</p>
        <p v-else-if="accuracy != null" class="field-hint">Treffrate: {{ accuracy }}% ({{ history.length }} forsøk)</p>
      </template>
    </PageHeader>

    <div v-if="mode === 'menu'" class="module-grid">
      <article class="module-card">
        <strong>Switch Challenge</strong>
        <span>Deduktiv: finn koden som gjør input om til output.</span>
        <AppButton @click="startSwitch">Start</AppButton>
      </article>
      <article class="module-card">
        <strong>Scales CLX</strong>
        <span>Induktiv: finn regelen og velg de to rutenettene som følger den.</span>
        <AppButton variant="secondary" @click="startClx">Start</AppButton>
      </article>
    </div>

    <article v-else-if="mode === 'switch' && switchPuzzle" class="panel stack">
      <div class="panel-heading-row">
        <h3>Switch Challenge</h3>
        <AppButton variant="ghost" @click="mode = 'menu'">Tilbake</AppButton>
      </div>
      <p class="field-hint">Velg koden som gjør figurene øverst om til figurene nederst. 1-2-3-4 betyr ingen endring.</p>
      <SwitchChallengeBoard
        :puzzle="switchPuzzle"
        :selected-index="selectedSwitch"
        :revealed="revealed"
        @select="selectSwitch"
      />
      <p v-if="lastCorrect === true" class="success-text">Riktig</p>
      <p v-else-if="lastCorrect === false" class="error-text">
        Feil. Riktig kode var {{ switchPuzzle.options[switchPuzzle.correctIndex]?.split("").join("-") }}.
      </p>
      <div class="page-header-actions">
        <AppButton v-if="!revealed" :disabled="selectedSwitch == null" @click="submitSwitch">Sjekk</AppButton>
        <AppButton v-else @click="startSwitch">Neste oppgave</AppButton>
      </div>
    </article>

    <article v-else-if="mode === 'clx' && clxPuzzle" class="panel stack">
      <div class="panel-heading-row">
        <h3>Scales CLX</h3>
        <AppButton variant="ghost" @click="mode = 'menu'">Tilbake</AppButton>
      </div>
      <p class="field-hint">Det er alltid nøyaktig to rutenett til høyre som følger regelen.</p>
      <ScalesClxBoard
        :puzzle="clxPuzzle"
        :selected="selectedClx"
        :revealed="revealed"
        @toggle="toggleClx"
      />
      <p v-if="lastCorrect === true" class="success-text">Riktig</p>
      <p v-else-if="lastCorrect === false" class="error-text">Feil. De riktige rutenettene er markert i grønt.</p>
      <div class="page-header-actions">
        <AppButton v-if="!revealed" :disabled="selectedClx.length !== 2" @click="submitClx">Sjekk</AppButton>
        <AppButton v-else @click="startClx">Neste oppgave</AppButton>
      </div>
    </article>
  </section>
</template>
