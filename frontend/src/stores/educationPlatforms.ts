import { defineStore } from "pinia";
import { ref } from "vue";
import type { LearningPlatform } from "@careercenter/shared";
import { api } from "../api/index.js";
import type { LearningPlatformPayload } from "../types/index.js";

function platformToPayload(platform: LearningPlatform): LearningPlatformPayload {
  return {
    name: platform.name,
    url: platform.url,
    notes: platform.notes,
    isActive: platform.isActive,
    sortOrder: platform.sortOrder
  };
}

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

  async function updatePlatformNotes(id: string, notes: string) {
    const platform = platforms.value.find((item) => item.id === id);
    if (!platform) return;
    const updated = await api.updateLearningPlatform(id, { ...platformToPayload(platform), notes });
    const index = platforms.value.findIndex((item) => item.id === id);
    if (index >= 0) platforms.value[index] = updated;
  }

  return { platforms, newPlatform, loadPlatforms, addPlatform, removePlatform, updatePlatformNotes };
});
