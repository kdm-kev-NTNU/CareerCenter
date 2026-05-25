import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { CareerTrack, Internship } from "@careercenter/shared";
import { api, type InternshipPayload } from "../api/index.js";
import { useInternshipSettingsStore } from "./internshipSettings.js";

const CUSTOM_COMPANY = "__custom__";

function emptyForm(settingsStore: ReturnType<typeof useInternshipSettingsStore>): InternshipPayload {
  return {
    companyId: null,
    companyName: "",
    title: "",
    description: "",
    applicationUrl: "",
    notes: "",
    deadline: null,
    statusId: settingsStore.statuses[0]?.id ?? "",
    locationIds: [],
    trackTags: [],
    requirements: settingsStore.requirementTypes.map((type) => ({
      requirementTypeId: type.id,
      isRequired: true,
      isDone: false,
      notes: ""
    }))
  };
}

export const useInternshipsStore = defineStore("internships", () => {
  const internships = ref<Internship[]>([]);
  const search = ref("");
  const statusFilter = ref("");
  const locationFilter = ref("");
  const trackFilter = ref("");
  const editingId = ref<string | null>(null);
  const isSubmitting = ref(false);
  const isLoading = ref(false);
  const loadError = ref("");
  const companyPicker = ref("");
  const form = ref<InternshipPayload>({
    companyId: null,
    companyName: "",
    title: "",
    description: "",
    applicationUrl: "",
    notes: "",
    deadline: null,
    statusId: "",
    locationIds: [],
    trackTags: [],
    requirements: []
  });

  const isEditing = computed(() => editingId.value !== null);

  function syncFormFromSettings() {
    const settingsStore = useInternshipSettingsStore();
    if (!form.value.statusId && settingsStore.statuses[0]) {
      form.value.statusId = settingsStore.statuses[0].id;
    }
    if (form.value.requirements.length === 0) {
      form.value = emptyForm(settingsStore);
    }
  }

  async function loadInternships() {
    isLoading.value = true;
    loadError.value = "";
    try {
      internships.value = await api.internships({
        q: search.value || undefined,
        statusId: statusFilter.value || undefined,
        locationId: locationFilter.value || undefined,
        track: (trackFilter.value || undefined) as CareerTrack | undefined
      });
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : "Kunne ikke laste internship.";
      throw caught;
    } finally {
      isLoading.value = false;
    }
  }

  function resetForm() {
    editingId.value = null;
    companyPicker.value = "";
    const settingsStore = useInternshipSettingsStore();
    form.value = emptyForm(settingsStore);
  }

  function startEdit(internship: Internship) {
    editingId.value = internship.id;
    companyPicker.value = internship.companyId ?? CUSTOM_COMPANY;
    form.value = {
      companyId: internship.companyId ?? null,
      companyName: internship.companyName,
      title: internship.title,
      description: internship.description,
      applicationUrl: internship.applicationUrl,
      notes: internship.notes,
      deadline: internship.deadline?.slice(0, 10) ?? null,
      statusId: internship.statusId,
      locationIds: [...internship.locationIds],
      trackTags: [...internship.trackTags],
      requirements: internship.requirements.map((item) => ({
        requirementTypeId: item.requirementTypeId,
        isRequired: item.isRequired,
        isDone: item.isDone,
        notes: item.notes
      }))
    };
  }

  function applyCompanySelection(companies: Array<{ id: string; name: string }>) {
    if (companyPicker.value === CUSTOM_COMPANY) {
      form.value.companyId = null;
      return;
    }
    const company = companies.find((item) => item.id === companyPicker.value);
    if (company) {
      form.value.companyId = company.id;
      form.value.companyName = company.name;
    }
  }

  function toggleLocation(id: string) {
    if (form.value.locationIds.includes(id)) {
      form.value.locationIds = form.value.locationIds.filter((locationId) => locationId !== id);
      return;
    }
    form.value.locationIds = [...form.value.locationIds, id];
  }

  function toggleTrack(track: CareerTrack) {
    if (form.value.trackTags.includes(track)) {
      form.value.trackTags = form.value.trackTags.filter((item) => item !== track);
      return;
    }
    form.value.trackTags = [...form.value.trackTags, track];
  }

  function requirementFor(typeId: string) {
    return form.value.requirements.find((item) => item.requirementTypeId === typeId);
  }

  async function saveInternship(companies: Array<{ id: string; name: string }>) {
    if (isSubmitting.value) return;
    applyCompanySelection(companies);
    if (!form.value.companyName.trim() || !form.value.title.trim() || !form.value.statusId) {
      throw new Error("Bedriftsnavn, stillingstittel og status er obligatorisk.");
    }

    const payload: InternshipPayload = {
      ...form.value,
      companyName: form.value.companyName.trim(),
      title: form.value.title.trim(),
      requirements: form.value.requirements.filter((item) => item.isRequired || item.isDone || item.notes)
    };

    isSubmitting.value = true;
    try {
      if (editingId.value) {
        const updated = await api.updateInternship(editingId.value, payload);
        internships.value = internships.value.map((item) => (item.id === updated.id ? updated : item));
      } else {
        const created = await api.createInternship(payload);
        internships.value = [created, ...internships.value];
      }
      resetForm();
    } finally {
      isSubmitting.value = false;
    }
  }

  async function removeInternship(id: string) {
    await api.deleteInternship(id);
    internships.value = internships.value.filter((item) => item.id !== id);
    if (editingId.value === id) resetForm();
  }

  function progressLabel(internship: Internship) {
    const required = internship.requirements.filter((item) => item.isRequired);
    const done = required.filter((item) => item.isDone).length;
    return `${done}/${required.length} krav fullført`;
  }

  return {
    internships,
    search,
    statusFilter,
    locationFilter,
    trackFilter,
    editingId,
    isSubmitting,
    isLoading,
    loadError,
    companyPicker,
    form,
    isEditing,
    CUSTOM_COMPANY,
    syncFormFromSettings,
    loadInternships,
    resetForm,
    startEdit,
    applyCompanySelection,
    toggleLocation,
    toggleTrack,
    requirementFor,
    saveInternship,
    removeInternship,
    progressLabel
  };
});
