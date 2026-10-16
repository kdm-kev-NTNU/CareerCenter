<script setup lang="ts">
import type { SimulatorCallState } from "@careercenter/shared";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AppButton from "../../ui/AppButton.vue";
import InterviewerAvatar from "./InterviewerAvatar.vue";

const props = withDefaults(
  defineProps<{
    callState: SimulatorCallState;
    companyName?: string;
    modeLabel?: string;
    planLabel?: string | null;
    interviewerName?: string;
    initials?: string;
    stream?: MediaStream | null;
    muted?: boolean;
    interviewerSpeaking?: boolean;
    userSpeaking?: boolean;
    elapsedSeconds?: number;
    essentialsOpen?: boolean;
  }>(),
  {
    companyName: "Intervju",
    modeLabel: "",
    planLabel: null,
    interviewerName: "Ingrid",
    initials: "Du",
    stream: null,
    muted: false,
    interviewerSpeaking: false,
    userSpeaking: false,
    elapsedSeconds: 0,
    essentialsOpen: false
  }
);

const emit = defineEmits<{
  leave: [];
  "toggle-mute": [];
  "toggle-essentials": [];
}>();

const selfVideoEl = ref<HTMLVideoElement | null>(null);

const hasVideo = computed(
  () => (props.stream?.getVideoTracks().filter((t) => t.readyState === "live").length ?? 0) > 0
);

const timerLabel = computed(() => {
  if (props.callState === "connecting") return "Kobler til …";
  if (props.callState === "finishing") {
    return `Samtalen er avsluttet · ${formatElapsed(props.elapsedSeconds)}`;
  }
  return `Opptak · ${formatElapsed(props.elapsedSeconds)}`;
});

const statusLabel = computed(() => {
  if (props.callState === "connecting") return "○ Henter stemme-sesjon";
  if (props.callState === "finishing") return "○ Frakoblet";
  return "● Live stemme tilkoblet";
});

const avatarListening = computed(
  () => props.userSpeaking && !props.interviewerSpeaking && props.callState === "live"
);

function formatElapsed(total: number) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function bindSelfVideo() {
  const el = selfVideoEl.value;
  if (!el) return;
  el.srcObject = hasVideo.value ? props.stream : null;
  if (hasVideo.value) {
    // jsdom's play() is a no-op and may not return a Promise.
    void Promise.resolve(el.play()).catch(() => undefined);
  }
}

watch(
  () => [props.stream, hasVideo.value] as const,
  () => bindSelfVideo(),
  { flush: "post" }
);

onMounted(() => bindSelfVideo());
onBeforeUnmount(() => {
  if (selfVideoEl.value) selfVideoEl.value.srcObject = null;
});
</script>

<template>
  <Teleport to="body">
    <div
      class="call-stage"
      role="dialog"
      aria-modal="true"
      aria-label="Intervjussamtale"
      data-test="call-stage"
      :data-call-state="callState"
    >
      <header class="call-stage__top">
        <div class="call-stage__title">
          <span class="call-stage__heading">Intervju · {{ companyName }}</span>
          <span v-if="modeLabel" class="call-stage__chip">{{ modeLabel }}</span>
        </div>
        <div class="call-stage__timer">
          <span
            class="call-stage__rec"
            :class="{ 'call-stage__rec--live': callState === 'live' }"
            aria-hidden="true"
          />
          <span data-test="call-timer">{{ timerLabel }}</span>
        </div>
        <p v-if="planLabel" class="call-stage__plan">{{ planLabel }}</p>
      </header>

      <div class="call-stage__stage">
        <div
          class="call-stage__main"
          :class="{ 'call-stage__main--speaking': interviewerSpeaking && callState === 'live' }"
          data-test="interviewer-tile"
        >
          <InterviewerAvatar
            :speaking="interviewerSpeaking && callState === 'live'"
            :listening="avatarListening"
            :name="interviewerName"
          />
          <div class="call-stage__name-tag">
            {{ interviewerName }} · Intervjuer (KI)
          </div>

          <div
            class="call-stage__self"
            :class="{
              'call-stage__self--speaking': userSpeaking && callState === 'live' && !muted,
              'call-stage__self--muted': muted
            }"
            data-test="self-tile"
          >
            <video
              v-show="hasVideo && callState !== 'finishing'"
              ref="selfVideoEl"
              class="call-stage__self-video"
              playsinline
              muted
              data-test="self-video"
            />
            <div
              v-if="!hasVideo || callState === 'finishing'"
              class="call-stage__self-fallback"
              data-test="self-initials"
            >
              <span class="call-stage__initials">{{ initials }}</span>
              <span class="call-stage__self-label">
                {{ callState === "finishing" ? "Kamera av" : "Du" }}
              </span>
            </div>
            <span v-else class="call-stage__you-tag">Du</span>
            <span
              v-if="muted && callState === 'live'"
              class="call-stage__mute-badge"
              aria-label="Mikrofon dempet"
              data-test="mute-badge"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" />
                <path
                  d="M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M19 10v2a7 7 0 0 1-12 5M12 19v3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </span>
          </div>

          <div
            v-if="callState === 'connecting'"
            class="call-stage__overlay"
            data-test="connecting-overlay"
          >
            <div class="call-stage__spinner" aria-hidden="true" />
            <p class="call-stage__overlay-title">Kobler til {{ interviewerName }} …</p>
            <p class="call-stage__overlay-hint">Tillat kamera og mikrofon hvis nettleseren spør.</p>
          </div>

          <div
            v-if="callState === 'finishing'"
            class="call-stage__overlay call-stage__overlay--light"
            data-test="finishing-overlay"
          >
            <div class="call-stage__spinner" aria-hidden="true" />
            <p class="call-stage__overlay-title call-stage__overlay-title--dark">
              Henter feedback …
            </p>
            <p class="call-stage__overlay-hint call-stage__overlay-hint--dark">
              {{ interviewerName }} vurderer svarene dine etter STAR. Mikrofonen er allerede slått
              av.
            </p>
          </div>

          <div
            v-if="muted && callState === 'live'"
            class="call-stage__toast"
            data-test="mute-toast"
          >
            Mikrofonen er dempet – intervjueren hører deg ikke
          </div>
        </div>
      </div>

      <footer class="call-stage__bar" :class="{ 'call-stage__bar--dim': callState === 'finishing' }">
        <p class="call-stage__status" data-test="call-status">{{ statusLabel }}</p>
        <div class="call-stage__controls">
          <button
            type="button"
            class="call-ctrl"
            :class="{ 'call-ctrl--on': muted }"
            data-test="toggle-mute"
            :disabled="callState !== 'live'"
            :aria-pressed="muted"
            @click="emit('toggle-mute')"
          >
            <span class="call-ctrl__icon" aria-hidden="true">{{ muted ? "🔇" : "🎤" }}</span>
            <span class="call-ctrl__label">{{ muted ? "Slå på" : "Demp" }}</span>
          </button>
          <button
            type="button"
            class="call-ctrl"
            :class="{ 'call-ctrl--accent': essentialsOpen }"
            data-test="toggle-essentials"
            :disabled="callState === 'finishing'"
            :aria-pressed="essentialsOpen"
            @click="emit('toggle-essentials')"
          >
            <span class="call-ctrl__icon" aria-hidden="true">📄</span>
            <span class="call-ctrl__label">Essentials</span>
          </button>
          <AppButton
            variant="primary"
            class="call-ctrl--leave"
            data-test="leave-call"
            :disabled="callState !== 'live'"
            :loading="callState === 'finishing'"
            @click="emit('leave')"
          >
            {{ callState === "finishing" ? "Henter feedback …" : "Avslutt" }}
          </AppButton>
        </div>
        <p class="call-stage__hint">Esc avslutter ikke samtalen</p>
      </footer>
    </div>
  </Teleport>
</template>

<style scoped>
.call-stage {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: #0b1220;
  color: #f3f4f6;
}

.call-stage__top,
.call-stage__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.5rem;
  background: #161e2e;
  min-height: 3.5rem;
}

.call-stage__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.call-stage__heading {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.call-stage__chip {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: #155d47;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.call-stage__timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
}

.call-stage__rec {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #6b7280;
}

.call-stage__rec--live {
  background: #c4314b;
}

.call-stage__plan,
.call-stage__status,
.call-stage__hint {
  margin: 0;
  font-size: 0.8rem;
  color: #9ca3af;
}

.call-stage__stage {
  display: flex;
  padding: 1rem 1.5rem;
  min-height: 0;
}

.call-stage__main {
  position: relative;
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 12px;
  background: #1f2937;
  overflow: hidden;
  border: 4px solid transparent;
}

.call-stage__main--speaking {
  border-color: #1f7a5c;
}

.call-stage__name-tag {
  position: absolute;
  left: 1.25rem;
  bottom: 1.25rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  font-size: 0.8rem;
  font-weight: 500;
}

.call-stage__self {
  position: absolute;
  right: 1.25rem;
  bottom: 1.25rem;
  width: min(280px, 32vw);
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: #161e2e;
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.call-stage__self--speaking {
  border: 4px solid #1f7a5c;
}

.call-stage__self-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.call-stage__self-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.call-stage__initials {
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: #1f7a5c;
  font-weight: 700;
  font-size: 1.25rem;
}

.call-stage__self-label,
.call-stage__you-tag {
  font-size: 0.8rem;
  color: #9ca3af;
}

.call-stage__you-tag {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
}

.call-stage__mute-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: #c4314b;
  color: #fff;
}

.call-stage__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.5rem;
  background: rgba(11, 18, 32, 0.7);
  text-align: center;
}

.call-stage__overlay--light {
  background: rgba(11, 18, 32, 0.55);
}

.call-stage__overlay--light::before {
  content: "";
  position: absolute;
  width: min(400px, 90%);
  height: 11rem;
  border-radius: 12px;
  background: #fff;
  z-index: 0;
}

.call-stage__overlay--light > * {
  position: relative;
  z-index: 1;
}

.call-stage__overlay-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.call-stage__overlay-title--dark {
  color: #111827;
}

.call-stage__overlay-hint {
  margin: 0;
  max-width: 22rem;
  font-size: 0.85rem;
  color: #9ca3af;
}

.call-stage__overlay-hint--dark {
  color: #4b5563;
}

.call-stage__spinner {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #1f7a5c;
  animation: spin 0.9s linear infinite;
}

.call-stage__overlay--light .call-stage__spinner {
  border-color: #e8f5ef;
  border-top-color: #1f7a5c;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .call-stage__spinner {
    animation: none;
  }
}

.call-stage__toast {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.6rem 1rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.8);
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.call-stage__controls {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.call-ctrl {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  color: inherit;
  padding: 0;
}

.call-ctrl:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.call-ctrl__icon {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  background: #1f2937;
  font-size: 1.25rem;
}

.call-ctrl--on .call-ctrl__icon {
  background: #fff;
  color: #111827;
}

.call-ctrl--accent .call-ctrl__icon {
  background: #155d47;
}

.call-ctrl__label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.call-ctrl--leave {
  background: #c4314b !important;
  border-color: #c4314b !important;
  align-self: center;
  margin-top: 0.15rem;
}

.call-stage__bar--dim {
  opacity: 0.45;
  pointer-events: none;
}

@media (max-width: 720px) {
  .call-stage__plan,
  .call-stage__hint {
    display: none;
  }

  .call-stage__self {
    top: 0.75rem;
    right: 0.75rem;
    bottom: auto;
    width: 6rem;
    aspect-ratio: 3 / 4;
  }

  .call-stage__name-tag {
    top: 0.75rem;
    bottom: auto;
    left: 0.75rem;
  }
}
</style>
