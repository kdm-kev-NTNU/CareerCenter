import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  InternshipLocationOption,
  InternshipRequirementType,
  InternshipStatusOption
} from "@careercenter/shared";
import { api } from "../api/index.js";

export const useInternshipSettingsStore = defineStore("internshipSettings", () => {
  const statuses = ref<InternshipStatusOption[]>([]);
  const locations = ref<InternshipLocationOption[]>([]);
  const requirementTypes = ref<InternshipRequirementType[]>([]);

  async function loadSettings() {
    const settings = await api.settings();
    statuses.value = settings.statuses;
    locations.value = settings.locations;
    requirementTypes.value = settings.requirementTypes;
  }

  async function addStatus(label: string) {
    const created = await api.createStatus({ label });
    statuses.value.push(created);
  }

  async function updateStatus(id: string, label: string) {
    const updated = await api.updateStatus(id, { label });
    if (!updated) return;
    statuses.value = statuses.value.map((item) => (item.id === id ? updated : item));
  }

  async function removeStatus(id: string) {
    await api.deleteStatus(id);
    statuses.value = statuses.value.filter((item) => item.id !== id);
  }

  async function addLocation(label: string) {
    const created = await api.createLocation({ label });
    locations.value.push(created);
  }

  async function updateLocation(id: string, label: string) {
    const updated = await api.updateLocation(id, { label });
    if (!updated) return;
    locations.value = locations.value.map((item) => (item.id === id ? updated : item));
  }

  async function removeLocation(id: string) {
    await api.deleteLocation(id);
    locations.value = locations.value.filter((item) => item.id !== id);
  }

  async function addRequirementType(label: string, description = "") {
    const created = await api.createRequirementType({ label, description });
    requirementTypes.value.push(created);
  }

  async function updateRequirementType(id: string, label: string, description: string) {
    const updated = await api.updateRequirementType(id, { label, description });
    if (!updated) return;
    requirementTypes.value = requirementTypes.value.map((item) => (item.id === id ? updated : item));
  }

  async function removeRequirementType(id: string) {
    await api.deleteRequirementType(id);
    requirementTypes.value = requirementTypes.value.filter((item) => item.id !== id);
  }

  return {
    statuses,
    locations,
    requirementTypes,
    loadSettings,
    addStatus,
    updateStatus,
    removeStatus,
    addLocation,
    updateLocation,
    removeLocation,
    addRequirementType,
    updateRequirementType,
    removeRequirementType
  };
});
