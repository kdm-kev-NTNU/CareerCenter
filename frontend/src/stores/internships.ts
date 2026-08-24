import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { CareerTrack, Internship } from "@careercenter/shared";
import { internshipTemplateStageIds, isInternshipStage } from "@careercenter/shared";
import { api, type InternshipPayload } from "../api/index.js";
import { useInternshipSettingsStore } from "./internshipSettings.js";

function emptyForm(settingsStore: ReturnType<typeof useInternshipSettingsStore>): InternshipPayload {
  const stageIds = internshipTemplateStageIds(settingsStore.statuses);
  return {
    companyName: "",
    title: "",
    description: "",
    applicationUrl: "",
    notes: "",
    deadline: null,
    statusId: stageIds[0] ?? settingsStore.statuses[0]?.id ?? "",
    stageIds,
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
  const form = ref<InternshipPayload>({
    companyName: "",
    title: "",
    description: "",
    applicationUrl: "",
    notes: "",
    deadline: null,
    statusId: "",
    stageIds: [],
    locationIds: [],
    trackTags: [],
    requirements: []
  });

  const isEditing = computed(() => editingId.value !== null);
  const formStatusOptions = computed(() => {
    const settingsStore = useInternshipSettingsStore();
    const byId = new Map(settingsStore.statuses.map((status) => [status.id, status]));
    const stages = form.value.stageIds
      .map((id) => byId.get(id))
      .filter((status): status is NonNullable<typeof status> => Boolean(status));
    const outcomes = settingsStore.statuses.filter((status) => status.kind === "outcome");
    return [...stages, ...outcomes];
  });
  const unusedTemplateStages = computed(() => {
    const settingsStore = useInternshipSettingsStore();
    const selected = new Set(form.value.stageIds);
    return settingsStore.statuses.filter((status) => isInternshipStage(status) && !selected.has(status.id));
  });

  function syncFormFromSettings() {
    const settingsStore = useInternshipSettingsStore();
    if (form.value.stageIds.length === 0) {
      form.value.stageIds = internshipTemplateStageIds(settingsStore.statuses);
    }
    if (!form.value.statusId) {
      form.value.statusId = form.value.stageIds[0] ?? settingsStore.statuses[0]?.id ?? "";
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
    const settingsStore = useInternshipSettingsStore();
    form.value = emptyForm(settingsStore);
  }

  function startEdit(internship: Internship) {
    editingId.value = internship.id;
    const settingsStore = useInternshipSettingsStore();
    form.value = {
      companyName: internship.companyName,
      title: internship.title,
      description: internship.description,
      applicationUrl: internship.applicationUrl,
      notes: internship.notes,
      deadline: internship.deadline?.slice(0, 10) ?? null,
      statusId: internship.statusId,
      stageIds: (internship.stageIds ?? []).length > 0 ? [...internship.stageIds] : internshipTemplateStageIds(settingsStore.statuses),
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

  function toggleStage(id: string) {
    if (form.value.stageIds.includes(id)) {
      if (form.value.stageIds.length === 1) return;
      form.value.stageIds = form.value.stageIds.filter((stageId) => stageId !== id);
      if (form.value.statusId === id) {
        form.value.statusId = form.value.stageIds[0] ?? "";
      }
      return;
    }
    form.value.stageIds = [...form.value.stageIds, id];
  }

  function moveStage(id: string, direction: -1 | 1) {
    const ids = [...form.value.stageIds];
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    form.value.stageIds = ids;
  }

  function requirementFor(typeId: string) {
    return form.value.requirements.find((item) => item.requirementTypeId === typeId);
  }

  async function saveInternship() {
    if (isSubmitting.value) return;
    if (!form.value.companyName.trim() || !form.value.title.trim() || !form.value.statusId) {
      throw new Error("Bedriftsnavn, stillingstittel og status er obligatorisk.");
    }
    if (form.value.stageIds.length === 0) {
      throw new Error("Søknadsflyt må ha minst ett steg.");
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
    form,
    isEditing,
    formStatusOptions,
    unusedTemplateStages,
    syncFormFromSettings,
    loadInternships,
    resetForm,
    startEdit,
    toggleLocation,
    toggleTrack,
    toggleStage,
    moveStage,
    requirementFor,
    saveInternship,
    removeInternship,
    progressLabel
  };
});
