<script setup lang="ts">
import type { GraduateProgram, Internship, InternshipStatusOption } from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import GraduateApplicationDialog from "../components/applications/GraduateApplicationDialog.vue";
import GraduateCatalog from "../components/applications/GraduateCatalog.vue";
import InternshipApplicationDialog from "../components/applications/InternshipApplicationDialog.vue";
import InternshipCatalog from "../components/applications/InternshipCatalog.vue";
import AppModal from "../components/listing/AppModal.vue";
import CatalogSettingsPanel from "../components/listing/CatalogSettingsPanel.vue";
import ListingRowActions from "../components/listing/ListingRowActions.vue";
import ListingTable from "../components/listing/ListingTable.vue";
import ListingToolbar from "../components/listing/ListingToolbar.vue";
import StatusBadge from "../components/listing/StatusBadge.vue";
import { useListingExpand } from "../composables/useListingExpand.js";
import { useAppStore } from "../stores/app.js";
import { useGraduateProgramSettingsStore } from "../stores/graduateProgramSettings.js";
import { useGraduateProgramsStore } from "../stores/graduatePrograms.js";
import { useInternshipSettingsStore } from "../stores/internshipSettings.js";
import { useInternshipsStore } from "../stores/internships.js";
import { debounce } from "../utils/debounce.js";
import {
  applicationKindFromQuery,
  sortApplications,
  type ApplicationKind,
  type ApplicationKindFilter
} from "./applicationRows.js";

interface ApplicationRow {
  key: string;
  id: string;
  kind: ApplicationKind;
  kindLabel: string;
  companyName: string;
  title: string;
  statusLabel: string;
  locationLabel: string;
  deadline?: string;
  progress: string;
  applicationUrl: string;
  description: string;
  notes: string;
  requirementBadges: string[];
  pipeline: { id: string; label: string; current: boolean }[];
}

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const internshipsStore = useInternshipsStore();
const programsStore = useGraduateProgramsStore();
const internshipSettingsStore = useInternshipSettingsStore();
const graduateSettingsStore = useGraduateProgramSettingsStore();
const { toggleExpand, isExpanded } = useListingExpand();

const search = ref("");
const catalogKind = ref<ApplicationKind>(applicationKindFromQuery(route.query.type) === "graduate" ? "graduate" : "internship");
const chooserOpen = ref(false);
const internshipModalOpen = ref(false);
const graduateModalOpen = ref(false);

const kindFilter = computed(() => applicationKindFromQuery(route.query.type));
const kindOptions: { id: ApplicationKindFilter; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "internship", label: "Internship" },
  { id: "graduate", label: "Graduate" }
];

const listingCountLabel = computed(() => `Antall søknader: ${rows.value.length}`);
const isLoading = computed(() => internshipsStore.isLoading || programsStore.isLoading);
const loadError = computed(() => internshipsStore.loadError || programsStore.loadError);

const rows = computed(() => {
  const internships = kindFilter.value === "graduate" ? [] : internshipsStore.internships.map(internshipRow);
  const programs = kindFilter.value === "internship" ? [] : programsStore.graduatePrograms.map(graduateRow);
  return sortApplications([...internships, ...programs]);
});

function internshipRow(internship: Internship): ApplicationRow {
  const pipeline = (internship.stageIds ?? [])
    .map((id) => internshipSettingsStore.statuses.find((status) => status.id === id))
    .filter((status): status is InternshipStatusOption => Boolean(status))
    .map((status) => ({ id: status.id, label: status.label, current: internship.statusId === status.id }));

  return {
    key: `internship:${internship.id}`,
    id: internship.id,
    kind: "internship",
    kindLabel: "Internship",
    companyName: internship.companyName,
    title: internship.title,
    statusLabel: internship.status?.label ?? "—",
    locationLabel: internship.locations?.map((location) => location.label).join(", ") || "Sted ikke valgt",
    deadline: internship.deadline,
    progress: internshipsStore.progressLabel(internship),
    applicationUrl: internship.applicationUrl,
    description: internship.description,
    notes: internship.notes,
    requirementBadges: requirementBadges(internship.requirements, internshipSettingsStore.requirementTypes),
    pipeline
  };
}

function graduateRow(program: GraduateProgram): ApplicationRow {
  return {
    key: `graduate:${program.id}`,
    id: program.id,
    kind: "graduate",
    kindLabel: "Graduate",
    companyName: program.companyName,
    title: program.title,
    statusLabel: program.status?.label ?? "—",
    locationLabel: program.locations?.map((location) => location.label).join(", ") || "Sted ikke valgt",
    deadline: program.deadline,
    progress: programsStore.progressLabel(program),
    applicationUrl: program.applicationUrl,
    description: program.description,
    notes: program.notes,
    requirementBadges: requirementBadges(program.requirements, graduateSettingsStore.requirementTypes),
    pipeline: []
  };
}

function requirementBadges(
  requirements: { requirementTypeId: string; isRequired: boolean; isDone: boolean }[],
  types: { id: string; label: string }[]
) {
  return requirements
    .filter((requirement) => requirement.isRequired)
    .map((requirement) => {
      const label = types.find((type) => type.id === requirement.requirementTypeId)?.label ?? "Krav";
      return requirement.isDone ? `${label} ✓` : label;
    });
}

function formatDeadline(value?: string) {
  if (!value) return "Ingen frist";
  return new Date(value).toLocaleDateString("nb-NO");
}

async function reload() {
  const tasks = [
    kindFilter.value === "graduate" ? Promise.resolve() : internshipsStore.loadInternships(),
    kindFilter.value === "internship" ? Promise.resolve() : programsStore.loadGraduatePrograms()
  ];
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result) => result.status === "rejected");
  if (failure && failure.status === "rejected") {
    appStore.setError(loadError.value || "Kunne ikke laste søknader.");
  }
}

const debouncedReload = debounce(() => {
  void reload();
}, 300);

function onSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  search.value = value;
  internshipsStore.search = value;
  programsStore.search = value;
  debouncedReload();
}

async function setKind(kind: ApplicationKindFilter) {
  internshipsStore.statusFilter = "";
  internshipsStore.locationFilter = "";
  programsStore.statusFilter = "";
  programsStore.locationFilter = "";
  if (kind !== "all") catalogKind.value = kind;
  const type = kind === "all" ? undefined : kind;
  await router.replace({ name: "applications", query: type ? { type } : {} });
  await reload();
}

function openAdd() {
  if (kindFilter.value === "internship") openCreate("internship");
  else if (kindFilter.value === "graduate") openCreate("graduate");
  else chooserOpen.value = true;
}

function openCreate(kind: ApplicationKind) {
  chooserOpen.value = false;
  if (kind === "internship") {
    internshipsStore.resetForm();
    internshipsStore.syncFormFromSettings();
    internshipModalOpen.value = true;
    return;
  }
  programsStore.resetForm();
  programsStore.syncFormFromSettings();
  graduateModalOpen.value = true;
}

function openEdit(row: ApplicationRow) {
  if (row.kind === "internship") {
    const internship = internshipsStore.internships.find((item) => item.id === row.id);
    if (!internship) return;
    internshipsStore.startEdit(internship);
    internshipModalOpen.value = true;
    return;
  }
  const program = programsStore.graduatePrograms.find((item) => item.id === row.id);
  if (!program) return;
  programsStore.startEdit(program);
  graduateModalOpen.value = true;
}

async function deleteRow(row: ApplicationRow) {
  if (!confirm("Slette denne søknaden?")) return;
  try {
    if (row.kind === "internship") await internshipsStore.removeInternship(row.id);
    else await programsStore.removeGraduateProgram(row.id);
  } catch (caught) {
    appStore.setError(caught instanceof Error ? caught.message : "Kunne ikke slette søknaden.");
  }
}

onMounted(() => {
  search.value = "";
  internshipsStore.search = "";
  programsStore.search = "";
  internshipsStore.statusFilter = "";
  internshipsStore.locationFilter = "";
  programsStore.statusFilter = "";
  programsStore.locationFilter = "";
  void reload();
});
</script>

<template>
  <section class="stack">
    <ListingToolbar @add="openAdd">
      <template #filters>
        <div class="segmented kind-filter" role="group" aria-label="Type søknad">
          <button
            v-for="option in kindOptions"
            :key="option.id"
            type="button"
            :class="{ active: kindFilter === option.id }"
            @click="setKind(option.id)"
          >
            {{ option.label }}
          </button>
        </div>
        <input :value="search" placeholder="Søk bedrift, rolle eller program..." @input="onSearchInput" />
        <select v-if="kindFilter === 'internship'" v-model="internshipsStore.statusFilter" @change="reload">
          <option value="">Alle statuser</option>
          <option v-for="status in internshipSettingsStore.statuses" :key="status.id" :value="status.id">{{ status.label }}</option>
        </select>
        <select v-if="kindFilter === 'internship'" v-model="internshipsStore.locationFilter" @change="reload">
          <option value="">Alle steder</option>
          <option v-for="location in internshipSettingsStore.locations" :key="location.id" :value="location.id">{{ location.label }}</option>
        </select>
        <select v-if="kindFilter === 'graduate'" v-model="programsStore.statusFilter" @change="reload">
          <option value="">Alle statuser</option>
          <option v-for="status in graduateSettingsStore.statuses" :key="status.id" :value="status.id">{{ status.label }}</option>
        </select>
        <select v-if="kindFilter === 'graduate'" v-model="programsStore.locationFilter" @change="reload">
          <option value="">Alle steder</option>
          <option v-for="location in graduateSettingsStore.locations" :key="location.id" :value="location.id">{{ location.label }}</option>
        </select>
      </template>
    </ListingToolbar>
    <p class="listing-summary">{{ listingCountLabel }}</p>

    <ListingTable :columns="['Bedrift / rolle', 'Status', 'Sted', 'Frist', 'Krav', '']">
      <p v-if="isLoading" class="listing-loading">Laster søknader...</p>
      <p v-else-if="loadError" class="listing-error">{{ loadError }}</p>
      <p v-else-if="rows.length === 0" class="listing-empty">Ingen søknader ennå.</p>
      <div v-for="row in rows" :key="row.key" class="listing-entry">
        <div
          class="listing-row"
          :class="{ 'listing-row--expanded': isExpanded(row.key) }"
          role="button"
          tabindex="0"
          @click="toggleExpand(row.key)"
          @keydown.enter.prevent="toggleExpand(row.key)"
        >
          <div class="listing-cell-title">
            <strong>{{ row.companyName }}</strong>
            <small>{{ row.title }}</small>
            <StatusBadge class="application-kind" :label="row.kindLabel" variant="blue" />
            <div v-if="row.pipeline.length" class="pipeline-stepper">
              <span
                v-for="(step, index) in row.pipeline"
                :key="step.id"
                class="pipeline-step"
                :class="{ current: step.current }"
              >
                {{ step.label }}<template v-if="index < row.pipeline.length - 1"> → </template>
              </span>
            </div>
          </div>
          <StatusBadge :label="row.statusLabel" variant="accent" />
          <span class="listing-cell-muted">{{ row.locationLabel }}</span>
          <span class="listing-cell-muted">{{ formatDeadline(row.deadline) }}</span>
          <span class="listing-cell-progress">{{ row.progress }}</span>
          <ListingRowActions
            :url="row.applicationUrl || null"
            @edit="openEdit(row)"
            @delete="deleteRow(row)"
          />
        </div>
        <div v-if="isExpanded(row.key)" class="listing-detail">
          <div v-if="row.pipeline.length">
            <p class="listing-detail-label">Søknadsflyt</p>
            <div class="pipeline-stepper">
              <span
                v-for="(step, index) in row.pipeline"
                :key="`detail-${step.id}`"
                class="pipeline-step"
                :class="{ current: step.current }"
              >
                {{ step.label }}<template v-if="index < row.pipeline.length - 1"> → </template>
              </span>
            </div>
          </div>
          <div v-if="row.description">
            <p class="listing-detail-label">Beskrivelse</p>
            <p>{{ row.description }}</p>
          </div>
          <div v-if="row.notes">
            <p class="listing-detail-label">Notater</p>
            <p>{{ row.notes }}</p>
          </div>
          <div v-if="row.requirementBadges.length">
            <p class="listing-detail-label">Krav</p>
            <div class="listing-detail-badges">
              <StatusBadge
                v-for="badge in row.requirementBadges"
                :key="badge"
                :label="badge"
                :variant="badge.includes('✓') ? 'accent' : 'muted'"
              />
            </div>
          </div>
          <a
            v-if="row.applicationUrl"
            class="listing-detail-link"
            :href="row.applicationUrl"
            target="_blank"
            rel="noreferrer"
            @click.stop
          >Åpne søknad →</a>
        </div>
      </div>
    </ListingTable>

    <CatalogSettingsPanel>
      <div class="catalog-kind-switch">
        <div class="segmented kind-filter" role="group" aria-label="Katalog">
          <button type="button" :class="{ active: catalogKind === 'internship' }" @click="catalogKind = 'internship'">Internship</button>
          <button type="button" :class="{ active: catalogKind === 'graduate' }" @click="catalogKind = 'graduate'">Graduate</button>
        </div>
      </div>
      <InternshipCatalog v-if="catalogKind === 'internship'" />
      <GraduateCatalog v-else />
    </CatalogSettingsPanel>

    <AppModal :open="chooserOpen" title="Ny søknad" size="sm" :resizable="false" @close="chooserOpen = false">
      <p>Velg hvilken type søknad du vil legge til.</p>
      <div class="chooser-actions">
        <button type="button" class="secondary" @click="openCreate('internship')">Internship</button>
        <button type="button" class="secondary" @click="openCreate('graduate')">Graduate</button>
      </div>
      <template #footer>
        <button type="button" class="ghost" @click="chooserOpen = false">Avbryt</button>
      </template>
    </AppModal>

    <InternshipApplicationDialog
      :open="internshipModalOpen"
      @close="internshipModalOpen = false"
      @saved="reload"
    />
    <GraduateApplicationDialog
      :open="graduateModalOpen"
      @close="graduateModalOpen = false"
      @saved="reload"
    />
  </section>
</template>
