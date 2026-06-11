import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  thesisCompanySources,
  thesisCompanyStatuses,
  type CareerTrack,
  type ThesisCompany,
  type ThesisCompanySource,
  type ThesisCompanyStatus
} from "@careercenter/shared";
import { api, type ThesisCompanyPayload } from "../api/index.js";

const emptyForm = (): ThesisCompanyPayload => ({
  companyName: "",
  topicArea: "",
  status: "known",
  source: "other",
  location: "",
  contactPerson: "",
  websiteUrl: "",
  targetSemester: null,
  trackTags: [],
  notes: "",
  sortOrder: 0
});

function toPayload(form: ThesisCompanyPayload): ThesisCompanyPayload {
  return {
    ...form,
    websiteUrl: form.websiteUrl?.trim() ? form.websiteUrl.trim() : null,
    targetSemester: form.targetSemester ?? null
  };
}

export const useThesisCompaniesStore = defineStore("thesisCompanies", () => {
  const companies = ref<ThesisCompany[]>([]);
  const form = ref<ThesisCompanyPayload>(emptyForm());
  const editingId = ref<string | null>(null);
  const filters = ref({
    q: "",
    status: "" as ThesisCompanyStatus | "",
    source: "" as ThesisCompanySource | "",
    track: "" as CareerTrack | ""
  });

  const filteredCompanies = computed(() => {
    const search = filters.value.q.trim().toLowerCase();
    return companies.value.filter((entry) => {
      if (filters.value.status && entry.status !== filters.value.status) return false;
      if (filters.value.source && entry.source !== filters.value.source) return false;
      if (filters.value.track && !entry.trackTags.includes(filters.value.track)) return false;
      if (!search) return true;
      const haystack = [entry.companyName, entry.topicArea, entry.location, entry.contactPerson, entry.notes]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  });

  async function loadCompanies() {
    companies.value = await api.thesisCompanies();
  }

  function resetForm() {
    editingId.value = null;
    form.value = emptyForm();
  }

  function startEdit(entry: ThesisCompany) {
    editingId.value = entry.id;
    form.value = {
      companyName: entry.companyName,
      topicArea: entry.topicArea,
      status: entry.status,
      source: entry.source,
      location: entry.location,
      contactPerson: entry.contactPerson,
      websiteUrl: entry.websiteUrl ?? "",
      targetSemester: entry.targetSemester ?? null,
      trackTags: [...entry.trackTags],
      notes: entry.notes,
      sortOrder: entry.sortOrder
    };
  }

  function toggleTrack(track: CareerTrack) {
    const tags = form.value.trackTags;
    form.value.trackTags = tags.includes(track) ? tags.filter((t) => t !== track) : [...tags, track];
  }

  async function saveCompany() {
    if (!form.value.companyName.trim()) {
      throw new Error("Bedriftsnavn er obligatorisk.");
    }
    const payload = toPayload({
      ...form.value,
      sortOrder: editingId.value ? form.value.sortOrder : companies.value.length
    });
    if (editingId.value) {
      const updated = await api.updateThesisCompany(editingId.value, payload);
      companies.value = companies.value.map((entry) => (entry.id === updated.id ? updated : entry));
    } else {
      const created = await api.createThesisCompany(payload);
      companies.value.push(created);
    }
    resetForm();
  }

  async function removeCompany(id: string) {
    await api.deleteThesisCompany(id);
    companies.value = companies.value.filter((entry) => entry.id !== id);
    if (editingId.value === id) resetForm();
  }

  return {
    companies,
    form,
    editingId,
    filters,
    thesisCompanyStatuses,
    thesisCompanySources,
    filteredCompanies,
    loadCompanies,
    saveCompany,
    startEdit,
    resetForm,
    removeCompany,
    toggleTrack
  };
});
