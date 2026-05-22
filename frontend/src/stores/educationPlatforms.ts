import { defineStore } from "pinia";
import { ref } from "vue";
import type { LearningPlatform } from "@careercenter/shared";
import { api } from "../api/index.js";
import type { LearningPlatformPayload } from "../types/index.js";

export const useEducationPlatformsStore = defineStore("educationPlatforms", () => {
  const platforms = ref<LearningPlatform[]>([]);
  const newPlatform = ref<LearningPlatformPayload>({
    name: "",
    url: "",
    notes: "",
    isActive: true,
    sortOrder: 0
  });

  async function loadPlatforms() {
    platforms.value = await api.learningPlatforms();
  }

  async function addPlatform() {
    const payload: LearningPlatformPayload = {
      ...newPlatform.value,
      url: newPlatform.value.url || undefined,
      sortOrder: platforms.value.length
    };
    const created = await api.createLearningPlatform(payload);
    platforms.value.push(created);
    newPlatform.value = {
      name: "",
      url: "",
      notes: "",
      isActive: true,
      sortOrder: 0
    };
  }

  async function removePlatform(id: string) {
    await api.deleteLearningPlatform(id);
    platforms.value = platforms.value.filter((platform) => platform.id !== id);
  }

  return { platforms, newPlatform, loadPlatforms, addPlatform, removePlatform };
});
