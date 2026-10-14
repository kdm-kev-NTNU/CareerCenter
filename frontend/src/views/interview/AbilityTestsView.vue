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

const mode = ref<"menu" | "switch" | "clx">("menu");
const seed = ref(Math.floor(Math.random() * 1_000_000));
const switchPuzzle = ref<SwitchChallengePuzzle | null>(null);
const clxPuzzle = ref<ScalesClxPuzzle | null>(null);
const selectedSwitch = ref<number | null>(null);
const selectedClx = ref<number[]>([]);
const feedback = ref<string | null>(null);
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

function startSwitch() {
  seed.value = Math.floor(Math.random() * 1_000_000);
  switchPuzzle.value = generateSwitchChallenge(seed.value);
  selectedSwitch.value = null;
  feedback.value = null;
  startedAt.value = Date.now();
  mode.value = "switch";
}

function startClx() {
  seed.value = Math.floor(Math.random() * 1_000_000);
  clxPuzzle.value = generateScalesClx(seed.value);
  selectedClx.value = [];
  feedback.value = null;
  startedAt.value = Date.now();
  mode.value = "clx";
}

function submitSwitch() {
  if (!switchPuzzle.value || selectedSwitch.value == null) return;
  const correct = isCorrectSwitchAnswer(switchPuzzle.value, selectedSwitch.value);
  feedback.value = correct ? "Riktig" : "Feil — riktig var " + switchPuzzle.value.options[switchPuzzle.value.correctIndex];
  void persistAttempt("switch_challenge", correct);
}

function toggleClx(i: number) {
  if (selectedClx.value.includes(i)) {
    selectedClx.value = selectedClx.value.filter((x) => x !== i);
  } else if (selectedClx.value.length < 2) {
    selectedClx.value = [...selectedClx.value, i];
  }
}

function submitClx() {
  if (!clxPuzzle.value) return;
  const correct = isCorrectClxSelection(clxPuzzle.value, selectedClx.value);
  feedback.value = correct ? "Riktig" : "Feil — velg de to rutene som følger regelen";
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
    <header>
      <h1>Evnetester</h1>
      <p class="lead">Switch Challenge og Scales CLX — lokal, seeded, uten lag.</p>
      <p v-if="loadingHistory" class="field-hint">Laster historikk …</p>
      <p v-else-if="accuracy != null" class="field-hint">Treffrate: {{ accuracy }}% ({{ history.length }} forsøk)</p>
    </header>

    <div v-if="mode === 'menu'" class="panel form-grid">
      <button type="button" @click="startSwitch">Start Switch Challenge</button>
      <button type="button" class="ghost" @click="startClx">Start Scales CLX</button>
    </div>

    <div v-else-if="mode === 'switch' && switchPuzzle" class="panel stack">
      <button type="button" class="ghost" @click="mode = 'menu'">Tilbake</button>
      <h2>Switch Challenge</h2>
      <p>Input: {{ switchPuzzle.input.join(" · ") }}</p>
      <p>Output: {{ switchPuzzle.output.join(" · ") }}</p>
      <div class="form-grid">
        <button
          v-for="(opt, i) in switchPuzzle.options"
          :key="opt"
          type="button"
          :class="{ active: selectedSwitch === i }"
          @click="selectedSwitch = i"
        >
          {{ opt }}
        </button>
      </div>
      <button type="button" :disabled="selectedSwitch == null" @click="submitSwitch">Sjekk</button>
      <p v-if="feedback">{{ feedback }}</p>
      <button type="button" class="ghost" @click="startSwitch">Neste</button>
    </div>

    <div v-else-if="mode === 'clx' && clxPuzzle" class="panel stack">
      <button type="button" class="ghost" @click="mode = 'menu'">Tilbake</button>
      <h2>Scales CLX</h2>
      <p>Disse to følger en regel. Velg to kandidater som følger samme regel.</p>
      <div class="form-grid">
        <div v-for="(grid, i) in clxPuzzle.candidates" :key="i">
          <button type="button" :class="{ active: selectedClx.includes(i) }" @click="toggleClx(i)">
            Kandidat {{ i + 1 }}
            <small>{{ grid.map((c) => c.shape[0]).join("") }}</small>
          </button>
        </div>
      </div>
      <button type="button" :disabled="selectedClx.length !== 2" @click="submitClx">Sjekk</button>
      <p v-if="feedback">{{ feedback }}</p>
      <button type="button" class="ghost" @click="startClx">Neste</button>
    </div>
  </section>
</template>
