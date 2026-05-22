import { defineStore } from "pinia";
import { ref } from "vue";
import type { CareerPath, Company } from "@careercenter/shared";
import { api, type PathPayload } from "../api/index.js";
import { useAppStore } from "./app.js";

export const usePathsStore = defineStore("paths", () => {
  const paths = ref<CareerPath[]>([]);
  const selectedCompanies = ref<Company[]>([]);
  const savingPath = ref(false);
  const newPath = ref<PathPayload>({
    name: "Energy Quant-ruten",
    description: "NTNU KI til global commodity trading",
    targetRole: "Quantitative Analyst",
    horizon: "5+ ar",
    steps: []
  });

  async function loadPaths() {
    paths.value = await api.paths();
  }

  function addToPath(company: Company) {
    if (!selectedCompanies.value.find((selected) => selected.id === company.id)) {
      selectedCompanies.value.push(company);
    }
  }

  function removeFromPath(companyId: string) {
    selectedCompanies.value = selectedCompanies.value.filter((company) => company.id !== companyId);
  }

  async function savePath() {
    if (selectedCompanies.value.length === 0) return;
    savingPath.value = true;
    try {
      const payload = {
        ...newPath.value,
        steps: selectedCompanies.value.map((company, index) => ({
          companyId: company.id,
          order: index,
          note: index === 0 ? "Forste sterke signal" : "",
          targetRole: newPath.value.targetRole
        }))
      };
      const created = await api.createPath(payload);
      paths.value.unshift(created);
    } finally {
      savingPath.value = false;
    }
  }

  async function duplicatePath(path: CareerPath) {
    const created = await api.createPath({
      name: `${path.name} kopi`,
      description: path.description,
      targetRole: path.targetRole,
      horizon: path.horizon,
      steps: path.steps.map((step, index) => ({
        companyId: step.companyId,
        order: index,
        note: step.note,
        targetRole: step.targetRole
      }))
    });
    paths.value.unshift(created);
  }

  function pathPayload(path: CareerPath): PathPayload {
    return {
      name: path.name,
      description: path.description,
      targetRole: path.targetRole,
      horizon: path.horizon,
      steps: path.steps.map((step, index) => ({
        companyId: step.companyId,
        order: index,
        note: step.note,
        targetRole: step.targetRole
      }))
    };
  }

  async function renamePath(id: string, name: string) {
    const path = paths.value.find((entry) => entry.id === id);
    const trimmed = name.trim();
    if (!path || !trimmed || trimmed === path.name) return;
    const appStore = useAppStore();
    try {
      const updated = await api.updatePath(id, { ...pathPayload(path), name: trimmed });
      paths.value = paths.value.map((entry) => (entry.id === id ? updated : entry));
    } catch (caught) {
      appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke omdøpe path.");
    }
  }

  async function removePath(id: string) {
    const path = paths.value.find((entry) => entry.id === id);
    if (!path) return;
    if (!confirm(`Slette «${path.name}»?`)) return;
    const appStore = useAppStore();
    try {
      await api.deletePath(id);
      paths.value = paths.value.filter((entry) => entry.id !== id);
    } catch (caught) {
      appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke slette path.");
    }
  }

  return {
    paths,
    selectedCompanies,
    savingPath,
    newPath,
    loadPaths,
    addToPath,
    removeFromPath,
    savePath,
    duplicatePath,
    renamePath,
    removePath
  };
});
