import type { UserProfile } from "@careercenter/shared";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { authApi } from "../api/auth.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<UserProfile | null>(null);
  const loading = ref(true);
  const error = ref("");

  const isAuthenticated = computed(() => user.value !== null);

  function clearError() {
    error.value = "";
  }

  async function fetchMe() {
    if (user.value !== null) {
      loading.value = false;
      return;
    }

    loading.value = true;
    clearError();
    try {
      user.value = await authApi.me();
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function register(name: string, pin: string) {
    clearError();
    user.value = await authApi.register(name.trim(), pin);
  }

  async function login(name: string, pin: string) {
    clearError();
    user.value = await authApi.login(name.trim(), pin);
  }

  async function logout() {
    clearError();
    try {
      await authApi.logout();
    } finally {
      user.value = null;
      loading.value = false;
    }
  }

  function setError(message: string) {
    error.value = message;
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    fetchMe,
    register,
    login,
    logout,
    clearError,
    setError
  };
});
