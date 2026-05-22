import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { careerTracks, type CareerTrack, type Company } from "@careercenter/shared";
import { api, type CompanyPayload } from "../api/index.js";

const emptyForm = (): CompanyPayload => ({
  name: "",
  description: "",
  tracks: ["ENERGY_QUANT"],
  tier: 1,
  geography: "",
  roleTypes: [],
  difficulty: "Medium",
  upside: "High",
  relevanceScore: 70,
  websiteUrl: ""
});

export const useCompaniesStore = defineStore("companies", () => {
  const companies = ref<Company[]>([]);
  const search = ref("");
  const trackFilter = ref<CareerTrack | "">("");
  const tierFilter = ref("");
  const form = ref<CompanyPayload>(emptyForm());
  const roleTypeDraft = ref("");
  const saving = ref(false);
  const error = ref<string | null>(null);

  const recommendedCompanies = computed(() => companies.value.slice(0, 5));
  const careerTrackOptions = careerTracks;

  async function loadCompanies() {
    const params = new URLSearchParams();
    if (search.value) params.set("q", search.value);
    if (trackFilter.value) params.set("track", trackFilter.value);
    if (tierFilter.value) params.set("tier", tierFilter.value);
    companies.value = await api.companies(params.toString() ? `?${params}` : "");
  }

  function resetForm() {
    form.value = emptyForm();
    roleTypeDraft.value = "";
    error.value = null;
  }

  function toggleTrack(track: CareerTrack) {
    const tracks = form.value.tracks;
    if (tracks.includes(track)) {
      form.value.tracks = tracks.length > 1 ? tracks.filter((entry) => entry !== track) : tracks;
      return;
    }
    form.value.tracks = [...tracks, track];
  }

  function addRoleType() {
    const value = roleTypeDraft.value.trim();
    if (!value) return;
    if (!form.value.roleTypes.includes(value)) {
      form.value.roleTypes = [...form.value.roleTypes, value];
    }
    roleTypeDraft.value = "";
  }

  function removeRoleType(role: string) {
    form.value.roleTypes = form.value.roleTypes.filter((entry) => entry !== role);
  }

  async function saveCompany(): Promise<Company | null> {
    error.value = null;
    if (!form.value.name.trim() || !form.value.description.trim() || !form.value.geography.trim()) {
      error.value = "Navn, beskrivelse og geografi er påkrevd.";
      return null;
    }
    if (form.value.roleTypes.length === 0) {
      error.value = "Legg til minst én rolletype.";
      return null;
    }
    saving.value = true;
    try {
      const payload: CompanyPayload = {
        ...form.value,
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        geography: form.value.geography.trim(),
        websiteUrl: form.value.websiteUrl?.trim() || undefined
      };
      const created = await api.createCompany(payload);
      search.value = created.name;
      await loadCompanies();
      return created;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Kunne ikke lagre bedriften.";
      return null;
    } finally {
      saving.value = false;
    }
  }

  return {
    companies,
    search,
    trackFilter,
    tierFilter,
    form,
    roleTypeDraft,
    saving,
    error,
    recommendedCompanies,
    careerTrackOptions,
    loadCompanies,
    resetForm,
    toggleTrack,
    addRoleType,
    removeRoleType,
    saveCompany
  };
});
