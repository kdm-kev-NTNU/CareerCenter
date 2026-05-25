import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { CareerTrack, GraduateProgram } from "@careercenter/shared";
import { api, type GraduateProgramPayload } from "../api/index.js";
import { useGraduateProgramSettingsStore } from "./graduateProgramSettings.js";

const CUSTOM_COMPANY = "__custom__";

function emptyForm(settingsStore: ReturnType<typeof useGraduateProgramSettingsStore>): GraduateProgramPayload {
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

export const useGraduateProgramsStore = defineStore("graduatePrograms", () => {
  const graduatePrograms = ref<GraduateProgram[]>([]);
  const search = ref("");
  const statusFilter = ref("");
  const locationFilter = ref("");
  const trackFilter = ref("");
  const editingId = ref<string | null>(null);
  const isSubmitting = ref(false);
  const companyPicker = ref("");
  const form = ref<GraduateProgramPayload>({
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
    const settingsStore = useGraduateProgramSettingsStore();
    if (!form.value.statusId && settingsStore.statuses[0]) {
      form.value.statusId = settingsStore.statuses[0].id;
    }
    if (form.value.requirements.length === 0) {
      form.value = emptyForm(settingsStore);
    }
  }

  async function loadGraduatePrograms() {
    graduatePrograms.value = await api.graduatePrograms({
      q: search.value || undefined,
      statusId: statusFilter.value || undefined,
      locationId: locationFilter.value || undefined,
      track: (trackFilter.value || undefined) as CareerTrack | undefined
    });
  }

  function resetForm() {
    editingId.value = null;
    companyPicker.value = "";
    const settingsStore = useGraduateProgramSettingsStore();
    form.value = emptyForm(settingsStore);
  }

  function startEdit(program: GraduateProgram) {
    editingId.value = program.id;
    companyPicker.value = program.companyId ?? CUSTOM_COMPANY;
    form.value = {
      companyId: program.companyId ?? null,
      companyName: program.companyName,
      title: program.title,
      description: program.description,
      applicationUrl: program.applicationUrl,
      notes: program.notes,
      deadline: program.deadline?.slice(0, 10) ?? null,
      statusId: program.statusId,
      locationIds: [...program.locationIds],
      trackTags: [...program.trackTags],
      requirements: program.requirements.map((item) => ({
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

  async function saveGraduateProgram(companies: Array<{ id: string; name: string }>) {
    if (isSubmitting.value) return;
    applyCompanySelection(companies);
    if (!form.value.companyName.trim() || !form.value.title.trim() || !form.value.statusId) {
      throw new Error("Bedriftsnavn, programnavn og status er obligatorisk.");
    }

    const payload: GraduateProgramPayload = {
      ...form.value,
      companyName: form.value.companyName.trim(),
      title: form.value.title.trim(),
      requirements: form.value.requirements.filter((item) => item.isRequired || item.isDone || item.notes)
    };

    isSubmitting.value = true;
    try {
      if (editingId.value) {
        const updated = await api.updateGraduateProgram(editingId.value, payload);
        graduatePrograms.value = graduatePrograms.value.map((item) => (item.id === updated.id ? updated : item));
      } else {
        const created = await api.createGraduateProgram(payload);
        graduatePrograms.value = [created, ...graduatePrograms.value];
      }
      resetForm();
    } finally {
      isSubmitting.value = false;
    }
  }

  async function removeGraduateProgram(id: string) {
    await api.deleteGraduateProgram(id);
    graduatePrograms.value = graduatePrograms.value.filter((item) => item.id !== id);
    if (editingId.value === id) resetForm();
  }

  function progressLabel(program: GraduateProgram) {
    const required = program.requirements.filter((item) => item.isRequired);
    const done = required.filter((item) => item.isDone).length;
    return `${done}/${required.length} krav fullført`;
  }

  return {
    graduatePrograms,
    search,
    statusFilter,
    locationFilter,
    trackFilter,
    editingId,
    isSubmitting,
    companyPicker,
    form,
    isEditing,
    CUSTOM_COMPANY,
    syncFormFromSettings,
    loadGraduatePrograms,
    resetForm,
    startEdit,
    applyCompanySelection,
    toggleLocation,
    toggleTrack,
    requirementFor,
    saveGraduateProgram,
    removeGraduateProgram,
    progressLabel
  };
});
