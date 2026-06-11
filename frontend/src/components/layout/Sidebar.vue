<script setup lang="ts">
import { useRouter, RouterLink } from "vue-router";
import { useAuthStore } from "../../stores/auth.js";

const router = useRouter();
const authStore = useAuthStore();

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/master", label: "Master Plan" },
  { to: "/education", label: "Utdanning" },
  { to: "/internships", label: "Internship" },
  { to: "/graduate", label: "Graduate" },
  { to: "/master-thesis", label: "Masteroppgave" },
  { to: "/competitions", label: "Hackathons & konkurranser" }
];

async function logout() {
  await authStore.logout();
  await router.push({ name: "login" });
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand-block">
      <span class="mark">CC</span>
      <div>
        <strong>CareerCenter</strong>
        <small v-if="authStore.user">Hei, {{ authStore.user.name }}</small>
        <small v-else>Personlig karrierebase</small>
      </div>
    </div>
    <nav>
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        custom
        v-slot="{ isActive, navigate }"
      >
        <button type="button" :class="{ active: isActive }" @click="navigate">{{ item.label }}</button>
      </RouterLink>
    </nav>
    <button type="button" class="ghost logout-btn" @click="logout">Logg ut</button>
  </aside>
</template>
