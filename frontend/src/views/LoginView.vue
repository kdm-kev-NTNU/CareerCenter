<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const router = useRouter();
const authStore = useAuthStore();

const mode = ref<"login" | "register">("login");
const name = ref("");
const pin = ref("");
const submitting = ref(false);

async function submit() {
  if (!name.value.trim() || !pin.value) {
    authStore.setError("Fyll inn navn og pinkode.");
    return;
  }
  if (!/^\d{4,6}$/.test(pin.value)) {
    authStore.setError("Pinkoden må være 4–6 siffer.");
    return;
  }

  submitting.value = true;
  authStore.clearError();
  try {
    if (mode.value === "register") {
      await authStore.register(name.value, pin.value);
    } else {
      await authStore.login(name.value, pin.value);
    }
    pin.value = "";
    await router.replace("/");
  } catch (caught) {
    authStore.setError(caught instanceof Error ? caught.message : "Innlogging feilet.");
  } finally {
    submitting.value = false;
  }
}

function switchMode(next: "login" | "register") {
  mode.value = next;
  authStore.clearError();
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-panel">
      <section class="panel">
        <span class="mark">CC</span>
        <h1>CareerCenter</h1>
        <p class="lead">
          Planlegg karrieren din med masterplan, bedriftsbase, internship og karriereboard —
          alt lagret trygt på din konto.
        </p>
      </section>

      <form class="auth-form panel" @submit.prevent="submit">
        <h2>{{ mode === "login" ? "Logg inn" : "Opprett bruker" }}</h2>

        <div class="segmented">
          <button type="button" :class="{ active: mode === 'login' }" @click="switchMode('login')">
            Logg inn
          </button>
          <button type="button" :class="{ active: mode === 'register' }" @click="switchMode('register')">
            Ny bruker
          </button>
        </div>

        <label>
          <span>Navn</span>
          <input
            v-model="name"
            type="text"
            autocomplete="username"
            maxlength="32"
            placeholder="Ditt navn"
            required
          />
        </label>

        <label>
          <span>Pinkode (4–6 siffer)</span>
          <input
            v-model="pin"
            type="password"
            inputmode="numeric"
            pattern="\d{4,6}"
            maxlength="6"
            autocomplete="current-password"
            placeholder="••••"
            required
          />
        </label>

        <p v-if="authStore.error" class="error-text">{{ authStore.error }}</p>

        <button type="submit" class="primary" :disabled="submitting">
          {{ submitting ? "Venter…" : mode === "login" ? "Logg inn" : "Opprett bruker" }}
        </button>
      </form>
    </div>
  </div>
</template>
