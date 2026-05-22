import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  competitionFormats,
  competitionScopes,
  competitionStatuses,
  competitionTypes,
  type CompetitionEntry,
  type CompetitionScope
} from "@careercenter/shared";
import { api, type CompetitionPayload } from "../api/index.js";

const emptyEntry = (): CompetitionPayload => ({
  title: "",
  type: "hackathon",
  scope: "NORWAY",
  format: "hybrid",
  startDate: "",
  endDate: "",
  registrationDeadline: "",
  location: "",
  organizer: "",
  url: "",
  status: "watching",
  notes: "",
  sortOrder: 0
});

function toDateInput(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function emptyToNull(value?: string | null): string | null {
  if (!value || value === "") return null;
  return value;
}

function toPayload(form: CompetitionPayload): CompetitionPayload {
  return {
    ...form,
    startDate: emptyToNull(form.startDate),
    endDate: emptyToNull(form.endDate),
    registrationDeadline: emptyToNull(form.registrationDeadline),
    url: form.url?.trim() ? form.url.trim() : null
  };
}

function eventDate(entry: CompetitionEntry): Date | null {
  const raw = entry.registrationDeadline ?? entry.startDate;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const useCompetitionsStore = defineStore("competitions", () => {
  const competitions = ref<CompetitionEntry[]>([]);
  const newEntry = ref<CompetitionPayload>(emptyEntry());
  const editingId = ref<string | null>(null);
  const filters = ref({
    q: "",
    scope: "" as CompetitionScope | "",
    type: "",
    status: "",
    upcomingOnly: false
  });

  const filteredCompetitions = computed(() => {
    const search = filters.value.q.trim().toLowerCase();
    return competitions.value.filter((entry) => {
      if (filters.value.scope && entry.scope !== filters.value.scope) return false;
      if (filters.value.type && entry.type !== filters.value.type) return false;
      if (filters.value.status && entry.status !== filters.value.status) return false;
      if (filters.value.upcomingOnly && !isUpcoming(entry)) return false;
      if (!search) return true;
      const haystack = [entry.title, entry.location, entry.organizer, entry.notes].join(" ").toLowerCase();
      return haystack.includes(search);
    });
  });

  const upcomingCompetitions = computed(() =>
    [...competitions.value]
      .filter((entry) => isUpcoming(entry))
      .sort((a, b) => (eventDate(a)?.getTime() ?? 0) - (eventDate(b)?.getTime() ?? 0))
  );

  const groupedByMonth = computed(() => {
    const groups = new Map<string, CompetitionEntry[]>();
    for (const entry of filteredCompetitions.value) {
      const date = eventDate(entry);
      if (!date) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(entry);
      groups.set(key, bucket);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, items]) => ({
        monthKey,
        label: formatMonthLabel(monthKey),
        items: items.sort((a, b) => (eventDate(a)?.getTime() ?? 0) - (eventDate(b)?.getTime() ?? 0))
      }));
  });

  async function loadCompetitions() {
    competitions.value = await api.competitions();
  }

  function resetForm() {
    editingId.value = null;
    newEntry.value = emptyEntry();
  }

  function startEdit(entry: CompetitionEntry) {
    editingId.value = entry.id;
    newEntry.value = {
      title: entry.title,
      type: entry.type,
      scope: entry.scope,
      format: entry.format,
      startDate: toDateInput(entry.startDate),
      endDate: toDateInput(entry.endDate),
      registrationDeadline: toDateInput(entry.registrationDeadline),
      location: entry.location,
      organizer: entry.organizer,
      url: entry.url ?? "",
      status: entry.status,
      notes: entry.notes,
      sortOrder: entry.sortOrder
    };
  }

  async function saveEntry() {
    const payload = toPayload({ ...newEntry.value, sortOrder: editingId.value ? newEntry.value.sortOrder : competitions.value.length });
    if (editingId.value) {
      const updated = await api.updateCompetition(editingId.value, payload);
      competitions.value = competitions.value.map((entry) => (entry.id === updated.id ? updated : entry));
    } else {
      const created = await api.createCompetition(payload);
      competitions.value.push(created);
    }
    resetForm();
  }

  async function removeCompetition(id: string) {
    await api.deleteCompetition(id);
    competitions.value = competitions.value.filter((entry) => entry.id !== id);
    if (editingId.value === id) resetForm();
  }

  return {
    competitions,
    newEntry,
    editingId,
    filters,
    competitionTypes,
    competitionScopes,
    competitionFormats,
    competitionStatuses,
    filteredCompetitions,
    upcomingCompetitions,
    groupedByMonth,
    loadCompetitions,
    saveEntry,
    startEdit,
    resetForm,
    removeCompetition,
    isUpcoming
  };
});

function isUpcoming(entry: CompetitionEntry): boolean {
  const date = eventDate(entry);
  if (!date) return false;
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);
  return date >= now && date <= horizon;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}
