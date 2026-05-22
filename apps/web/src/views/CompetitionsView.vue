<script setup lang="ts">
import {
  competitionFormatLabels,
  competitionScopeLabels,
  competitionStatusLabels,
  competitionTypeLabels,
  type CompetitionEntry,
  type CompetitionType
} from "@careercenter/shared";
import { computed, onMounted, ref } from "vue";
import AppModal from "../components/listing/AppModal.vue";
import ListingRowActions from "../components/listing/ListingRowActions.vue";
import ListingTable from "../components/listing/ListingTable.vue";
import ListingToolbar from "../components/listing/ListingToolbar.vue";
import StatusBadge from "../components/listing/StatusBadge.vue";
import { useListingExpand } from "../composables/useListingExpand.js";
import { useCompetitionsStore } from "../stores/competitions.js";

const store = useCompetitionsStore();
const { toggleExpand, isExpanded } = useListingExpand();

const viewMode = ref<"list" | "timeline">("list");
const modalOpen = ref(false);

const modalTitle = computed(() =>
  store.editingId ? "Rediger arrangement" : "Legg til arrangement"
);

const statusFilterValue = computed({
  get() {
    if (store.filters.upcomingOnly) return "upcoming";
    return store.filters.status;
  },
  set(value: string) {
    if (value === "upcoming") {
      store.filters.upcomingOnly = true;
      store.filters.status = "";
    } else {
      store.filters.upcomingOnly = false;
      store.filters.status = value;
    }
  }
});

function typeBadgeVariant(type: CompetitionType): "accent" | "blue" | "muted" {
  if (type === "hackathon") return "accent";
  if (type === "datathon" || type === "case_competition") return "blue";
  return "muted";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nb-NO");
}

function dateRange(entry: CompetitionEntry): string {
  if (entry.startDate && entry.endDate) return `${formatDate(entry.startDate)} – ${formatDate(entry.endDate)}`;
  if (entry.startDate) return formatDate(entry.startDate);
  if (entry.registrationDeadline) return `Frist ${formatDate(entry.registrationDeadline)}`;
  return "Ingen dato";
}

function openAddModal() {
  store.resetForm();
  modalOpen.value = true;
}

function openEditModal(entry: CompetitionEntry) {
  store.startEdit(entry);
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
  store.resetForm();
}

async function saveEntry() {
  await store.saveEntry();
  closeModal();
}

async function removeEntry(id: string) {
  if (!confirm("Slette dette arrangementet?")) return;
  await store.removeCompetition(id);
}

onMounted(() => {
  void store.loadCompetitions();
});
</script>

<template>
  <section class="stack">
    <div class="segmented listing-view-tabs">
      <button type="button" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">Liste</button>
      <button type="button" :class="{ active: viewMode === 'timeline' }" @click="viewMode = 'timeline'">Tidslinje</button>
    </div>

    <ListingToolbar @add="openAddModal">
      <template #filters>
        <input v-model="store.filters.q" placeholder="Søk tittel, sted, arrangør..." />
        <select v-model="store.filters.type">
          <option value="">Alle typer</option>
          <option v-for="type in store.competitionTypes" :key="type" :value="type">
            {{ competitionTypeLabels[type] }}
          </option>
        </select>
        <select v-model="statusFilterValue">
          <option value="">Alle statuser</option>
          <option value="upcoming">Kommende</option>
          <option v-for="status in store.competitionStatuses" :key="status" :value="status">
            {{ competitionStatusLabels[status] }}
          </option>
        </select>
      </template>
    </ListingToolbar>

    <template v-if="viewMode === 'list'">
      <ListingTable layout="competitions" :columns="['Tittel', 'Type', 'Region', 'Datoer', 'Status', '']">
        <p v-if="store.filteredCompetitions.length === 0" class="listing-empty">Ingen arrangementer matcher filteret.</p>
        <div v-for="entry in store.filteredCompetitions" :key="entry.id" class="listing-entry">
          <div
            class="listing-row"
            :class="{ 'listing-row--expanded': isExpanded(entry.id) }"
            role="button"
            tabindex="0"
            @click="toggleExpand(entry.id)"
            @keydown.enter.prevent="toggleExpand(entry.id)"
          >
            <div class="listing-cell-title">
              <strong>{{ entry.title }}</strong>
            </div>
            <StatusBadge :label="competitionTypeLabels[entry.type]" :variant="typeBadgeVariant(entry.type)" />
            <StatusBadge :label="competitionScopeLabels[entry.scope]" variant="muted" />
            <span class="listing-cell-muted">{{ dateRange(entry) }}</span>
            <StatusBadge :label="competitionStatusLabels[entry.status]" variant="accent" />
            <ListingRowActions
              :url="entry.url || null"
              @edit="openEditModal(entry)"
              @delete="removeEntry(entry.id)"
            />
          </div>
          <div v-if="isExpanded(entry.id)" class="listing-detail">
            <div class="listing-detail-meta">
              <span>Format: {{ competitionFormatLabels[entry.format] }}</span>
              <span v-if="entry.organizer">Arrangør: {{ entry.organizer }}</span>
              <span v-if="entry.registrationDeadline">Påmelding: {{ formatDate(entry.registrationDeadline) }}</span>
              <span v-if="entry.location">Sted: {{ entry.location }}</span>
            </div>
            <div v-if="entry.notes">
              <p class="listing-detail-label">Notater</p>
              <p>{{ entry.notes }}</p>
            </div>
            <a
              v-if="entry.url"
              class="listing-detail-link"
              :href="entry.url"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >Nettside →</a>
          </div>
        </div>
      </ListingTable>
    </template>

    <article v-else class="panel timeline">
      <p v-if="store.groupedByMonth.length === 0" class="muted-empty">Legg inn startdato eller påmeldingsfrist for å se tidslinjen.</p>
      <div v-for="month in store.groupedByMonth" :key="month.monthKey" class="timeline-month">
        <h3>{{ month.label }}</h3>
        <div v-for="entry in month.items" :key="entry.id" class="timeline-item">
          <div>
            <strong>{{ entry.title }}</strong>
            <small>{{ competitionScopeLabels[entry.scope] }} · {{ dateRange(entry) }}</small>
          </div>
          <span v-if="store.isUpcoming(entry)" class="badge-upcoming">Kommende</span>
        </div>
      </div>
    </article>

    <AppModal :open="modalOpen" :title="modalTitle" @close="closeModal">
      <form class="form-grid" @submit.prevent="saveEntry">
        <label>Tittel<input v-model="store.newEntry.title" placeholder="Junction, NMiAI Grocery Bot" required /></label>
        <label>Type<select v-model="store.newEntry.type">
          <option v-for="type in store.competitionTypes" :key="type" :value="type">{{ competitionTypeLabels[type] }}</option>
        </select></label>
        <label>Region<select v-model="store.newEntry.scope">
          <option v-for="scope in store.competitionScopes" :key="scope" :value="scope">{{ competitionScopeLabels[scope] }}</option>
        </select></label>
        <label>Format<select v-model="store.newEntry.format">
          <option v-for="format in store.competitionFormats" :key="format" :value="format">{{ competitionFormatLabels[format] }}</option>
        </select></label>
        <label>Startdato<input v-model="store.newEntry.startDate" type="date" /></label>
        <label>Sluttdato<input v-model="store.newEntry.endDate" type="date" /></label>
        <label>Påmeldingsfrist<input v-model="store.newEntry.registrationDeadline" type="date" /></label>
        <label>Sted<input v-model="store.newEntry.location" placeholder="Trondheim / Online" /></label>
        <label>Arrangør<input v-model="store.newEntry.organizer" placeholder="NTNU, Junction" /></label>
        <label>Lenke<input v-model="store.newEntry.url" type="url" placeholder="https://..." /></label>
        <label>Status<select v-model="store.newEntry.status">
          <option v-for="status in store.competitionStatuses" :key="status" :value="status">{{ competitionStatusLabels[status] }}</option>
        </select></label>
        <label class="wide-field">Notater<textarea v-model="store.newEntry.notes" placeholder="Team, krav, hvorfor det er relevant" /></label>
      </form>
      <template #footer>
        <button type="button" class="ghost" @click="closeModal">Avbryt</button>
        <button type="button" class="primary" @click="saveEntry">
          {{ store.editingId ? "Lagre endringer" : "Legg til" }}
        </button>
      </template>
    </AppModal>
  </section>
</template>
