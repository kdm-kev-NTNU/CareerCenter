<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { CareerMapNode, CareerPath, CareerTrack, CareerTrackSetting, Company, CoursePlan, CourseStatus } from "@careercenter/shared";
import { careerTracks, trackLabels } from "@careercenter/shared";
import { api, type CoursePayload, type PathPayload, type TrackPayload } from "./api";

type Page = "dashboard" | "master" | "map" | "companies" | "paths";

const page = ref<Page>("dashboard");
const error = ref("");
const courses = ref<CoursePlan[]>([]);
const companies = ref<Company[]>([]);
const paths = ref<CareerPath[]>([]);
const mapNodes = ref<CareerMapNode[]>([]);
const trackSettings = ref<CareerTrackSetting[]>([]);
const editingMapNodeId = ref<string | null>(null);
const editingMapTitle = ref("");
const editingMapItemsList = ref<string[]>([]);
const editingTrackId = ref<CareerTrack | null>(null);
const editingTrackLabel = ref("");
const search = ref("");
const trackFilter = ref<CareerTrack | "">("");
const tierFilter = ref("");
const mapTrack = ref<CareerTrack | "">("");
const selectedCompanies = ref<Company[]>([]);
const savingPath = ref(false);

const newCourse = ref<CoursePayload>({
  semester: 7,
  courseCode: "",
  title: "",
  credits: 7.5,
  status: "planned",
  notes: "",
  trackTags: ["ENERGY_QUANT"],
  sortOrder: 0
});

const newPath = ref<PathPayload>({
  name: "Energy Quant-ruten",
  description: "NTNU KI til global commodity trading",
  targetRole: "Quantitative Analyst",
  horizon: "5+ ar",
  steps: []
});

const semesters = [7, 8, 9, 10] as const;
const statuses: CourseStatus[] = ["planned", "considering", "confirmed", "completed"];
const trackList = computed(() => trackSettings.value.length ? trackSettings.value : careerTracks.map((track, index) => ({ id: track, label: trackLabels[track], sortOrder: index })));
const tracks = computed(() => trackList.value.map((track) => track.id));
const visibleMapNodes = computed(() => mapNodes.value.filter((node) => !mapTrack.value || node.track === mapTrack.value || node.level === 0));
const recommendedCompanies = computed(() => companies.value.slice(0, 5));
const selectedMapNode = computed(() => mapNodes.value.find((node) => node.id === editingMapNodeId.value) ?? null);
const selectedTrack = computed(() => trackList.value.find((track) => track.id === editingTrackId.value) ?? null);

function trackName(track: CareerTrack) {
  return trackList.value.find((entry) => entry.id === track)?.label ?? trackLabels[track];
}

async function loadPrivateData() {
  courses.value = await api.courses();
  paths.value = await api.paths();
}

async function loadPublicData() {
  const params = new URLSearchParams();
  if (search.value) params.set("q", search.value);
  if (trackFilter.value) params.set("track", trackFilter.value);
  if (tierFilter.value) params.set("tier", tierFilter.value);
  companies.value = await api.companies(params.toString() ? `?${params}` : "");
}

function openMapEditor(node: CareerMapNode) {
  editingMapNodeId.value = node.id;
  editingMapTitle.value = node.title;
  editingMapItemsList.value = [...node.items];
}

function clearMapEditor() {
  editingMapNodeId.value = null;
  editingMapTitle.value = "";
  editingMapItemsList.value = [];
}

function addMapItem() {
  editingMapItemsList.value.push("");
}

function removeMapItem(index: number) {
  editingMapItemsList.value.splice(index, 1);
}

async function saveMapEditor() {
  if (!editingMapNodeId.value) return;
  const items = editingMapItemsList.value.map((item) => item.trim()).filter(Boolean);
  const updated = await api.updateMapNode(editingMapNodeId.value, { title: editingMapTitle.value.trim() || selectedMapNode.value?.title || "", items });
  mapNodes.value = mapNodes.value.map((node) => (node.id === updated.id ? updated : node));
  clearMapEditor();
}

async function resetMapEditor() {
  if (!editingMapNodeId.value) return;
  const updated = await api.resetMapNode(editingMapNodeId.value);
  mapNodes.value = mapNodes.value.map((node) => (node.id === updated.id ? updated : node));
  clearMapEditor();
}

function openTrackEditor(track: CareerTrackSetting) {
  editingTrackId.value = track.id;
  editingTrackLabel.value = track.label;
}

function clearTrackEditor() {
  editingTrackId.value = null;
  editingTrackLabel.value = "";
}

async function saveTrackEditor() {
  if (!editingTrackId.value) return;
  const updated = await api.updateTrack(editingTrackId.value, { label: editingTrackLabel.value.trim() || selectedTrack.value?.label || "" } as TrackPayload);
  trackSettings.value = trackSettings.value.map((track) => (track.id === updated.id ? updated : track));
  clearTrackEditor();
}

async function resetTrackEditor() {
  if (!editingTrackId.value) return;
  const updated = await api.resetTrack(editingTrackId.value);
  trackSettings.value = trackSettings.value.map((track) => (track.id === updated.id ? updated : track));
  clearTrackEditor();
}

async function addCourse() {
  const created = await api.createCourse({ ...newCourse.value, sortOrder: courses.value.length });
  courses.value.push(created);
  newCourse.value = {
    semester: newCourse.value.semester,
    courseCode: "",
    title: "",
    credits: 7.5,
    status: "planned",
    notes: "",
    trackTags: ["ENERGY_QUANT"],
    sortOrder: 0
  };
}

async function removeCourse(id: string) {
  await api.deleteCourse(id);
  courses.value = courses.value.filter((course) => course.id !== id);
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

async function removePath(id: string) {
  try {
    await api.deletePath(id);
    paths.value = paths.value.filter((path) => path.id !== id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Kunne ikke slette path.";
  }
}

onMounted(async () => {
  localStorage.removeItem("careercenter-map-drafts");
  try {
    const map = await api.careerMap();
    mapNodes.value = map.nodes;
    trackSettings.value = map.tracks;
    await loadPublicData();
    await loadPrivateData();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Kunne ikke laste appdata.";
  }
});
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand-block">
        <span class="mark">CC</span>
        <div>
          <strong>CareerCenter</strong>
          <small>Enbruker-base</small>
        </div>
      </div>
      <nav>
        <button type="button" :class="{ active: page === 'dashboard' }" @click="page = 'dashboard'">Dashboard</button>
        <button type="button" :class="{ active: page === 'master' }" @click="page = 'master'">Master Plan</button>
        <button type="button" :class="{ active: page === 'map' }" @click="page = 'map'">Karrierekart</button>
        <button type="button" :class="{ active: page === 'companies' }" @click="page = 'companies'">Bedrifter</button>
        <button type="button" :class="{ active: page === 'paths' }" @click="page = 'paths'">Custom Paths</button>
      </nav>
    </aside>

    <section class="content">
      <header class="topbar">
        <div>
          <h1>{{ page === "dashboard" ? "Dashboard" : page === "master" ? "Master Plan" : page === "map" ? "Karrierekart" : page === "companies" ? "Bedriftsbase" : "Custom Paths" }}</h1>
          <p>KI-master -> teknisk tung AI/data -> kommersiell verdiskaping.</p>
        </div>
      </header>

      <p v-if="error" class="panel error">{{ error }}</p>

      <section v-if="page === 'dashboard'" class="grid three">
        <article class="panel strong">
          <h2>Masterstatus</h2>
          <strong>{{ courses.length }}</strong>
          <p>fag er lagt inn for semester 7-10.</p>
        </article>
        <article class="panel strong">
          <h2>Lagrede paths</h2>
          <strong>{{ paths.length }}</strong>
          <p>custom paths er aktive i databasen.</p>
        </article>
        <article class="panel strong">
          <h2>Neste steg</h2>
          <p>Start med 3-5 selskaper i en path og knytt fagvalgene til samme spor.</p>
        </article>
        <article class="panel wide">
          <h2>Hoyest relevans akkurat na</h2>
          <div class="company-row" v-for="company in recommendedCompanies" :key="company.id">
            <span>{{ company.name }}</span>
            <small>{{ company.geography }} - score {{ company.relevanceScore }}</small>
          </div>
        </article>
      </section>

      <section v-if="page === 'master'" class="stack">
        <form class="panel form-grid" @submit.prevent="addCourse">
          <label>Semester<select v-model.number="newCourse.semester"><option v-for="semester in semesters" :key="semester" :value="semester">Semester {{ semester }}</option></select></label>
          <label>Fagkode<input v-model="newCourse.courseCode" placeholder="TDT4173" required /></label>
          <label>Tittel<input v-model="newCourse.title" placeholder="Machine Learning" required /></label>
          <label>Studiepoeng<input v-model.number="newCourse.credits" type="number" step="0.5" /></label>
          <label>Status<select v-model="newCourse.status"><option v-for="status in statuses" :key="status">{{ status }}</option></select></label>
          <label>Spor<select v-model="newCourse.trackTags[0]"><option v-for="track in tracks" :key="track" :value="track">{{ trackName(track) }}</option></select></label>
          <label class="wide-field">Notater<textarea v-model="newCourse.notes" placeholder="Hvorfor faget passer pathen" /></label>
          <button class="primary" type="submit">Legg til fag</button>
        </form>

        <div class="semester-grid">
          <article class="panel" v-for="semester in semesters" :key="semester">
            <h2>Semester {{ semester }}</h2>
            <div v-for="course in courses.filter((item) => item.semester === semester)" :key="course.id" class="course-card">
              <div>
                <strong>{{ course.courseCode }} - {{ course.title }}</strong>
                <small>{{ course.credits }} stp - {{ course.status }} - {{ course.trackTags.map((track) => trackName(track)).join(", ") }}</small>
                <p>{{ course.notes }}</p>
              </div>
              <button type="button" class="icon" aria-label="Slett fag" @click="removeCourse(course.id)">x</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="page === 'map'" class="stack">
        <article class="panel editor">
          <div class="path-header">
            <div>
              <h2>Rediger spor</h2>
              <p>Navnene brukes i filtre, selskapsvisning og karrierekartet.</p>
            </div>
          </div>
          <div class="track-list">
            <div v-for="track in trackList" :key="track.id" class="track-row" :class="{ editing: editingTrackId === track.id }">
              <template v-if="editingTrackId === track.id">
                <div class="track-row-edit">
                  <input v-model="editingTrackLabel" class="inline-title" />
                  <small>{{ track.id }}</small>
                </div>
                <div class="actions">
                  <button type="button" class="primary" @click="saveTrackEditor">Lagre</button>
                  <button type="button" class="secondary" @click="resetTrackEditor">Tilbakestill</button>
                  <button type="button" class="ghost" @click="clearTrackEditor">Avbryt</button>
                </div>
              </template>
              <template v-else>
                <div>
                  <strong>{{ trackName(track.id) }}</strong>
                  <small>{{ track.id }}</small>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" @click="openTrackEditor(track)">Rediger</button>
                </div>
              </template>
            </div>
          </div>
        </article>

        <div class="toolbar">
          <button type="button" :class="{ active: !mapTrack }" @click="mapTrack = ''">Alle spor</button>
          <button
            v-for="track in tracks"
            :key="track"
            type="button"
            :class="{ active: mapTrack === track }"
            @click="mapTrack = track"
          >
            {{ trackName(track) }}
          </button>
        </div>

        <div class="map">
          <article v-for="node in visibleMapNodes" :key="node.id" class="map-node" :class="[`level-${node.level}`, { editing: editingMapNodeId === node.id }]">
            <template v-if="editingMapNodeId === node.id">
              <div class="map-head">
                <input v-model="editingMapTitle" class="inline-title" />
                <div class="actions">
                  <button type="button" class="primary" @click="saveMapEditor">Lagre</button>
                  <button type="button" class="secondary" @click="resetMapEditor">Tilbakestill</button>
                  <button type="button" class="ghost" @click="clearMapEditor">Avbryt</button>
                </div>
              </div>
              <ul class="editable-items">
                <li v-for="(_item, index) in editingMapItemsList" :key="index">
                  <input v-model="editingMapItemsList[index]" />
                  <button type="button" class="icon" aria-label="Slett punkt" @click="removeMapItem(index)">x</button>
                </li>
              </ul>
              <button type="button" class="ghost add-item" @click="addMapItem">+ Legg til punkt</button>
            </template>
            <template v-else>
              <div class="map-head">
                <h2>{{ node.title }}</h2>
                <button type="button" class="secondary map-edit" @click="openMapEditor(node)">Rediger</button>
              </div>
              <ul>
                <li v-for="item in node.items" :key="item">{{ item }}</li>
              </ul>
            </template>
          </article>
        </div>
      </section>

      <section v-if="page === 'companies' || page === 'paths'" class="stack">
        <div class="panel filters">
          <input v-model="search" placeholder="Sok etter selskap, rolle eller geografi" @input="loadPublicData" />
          <select v-model="trackFilter" @change="loadPublicData">
            <option value="">Alle spor</option>
            <option v-for="track in tracks" :key="track" :value="track">{{ trackName(track) }}</option>
          </select>
          <select v-model="tierFilter" @change="loadPublicData">
            <option value="">Alle tiers</option>
            <option value="1">Tier 1 Norge-start</option>
            <option value="2">Tier 2 Norden/Europa</option>
            <option value="3">Tier 3 global elite</option>
          </select>
        </div>

        <div class="grid two">
          <article class="panel company-list">
            <h2>Bedrifter</h2>
            <div v-for="company in companies" :key="company.id" class="company-card">
              <div>
                <strong>{{ company.name }}</strong>
                <p>{{ company.description }}</p>
                <small>Tier {{ company.tier }} - {{ company.geography }} - {{ company.difficulty }} - score {{ company.relevanceScore }}</small>
              </div>
              <button type="button" class="secondary" @click="addToPath(company)">Legg til</button>
            </div>
          </article>

          <article class="panel builder">
            <h2>Path builder</h2>
            <label>Navn<input v-model="newPath.name" /></label>
            <label>Malrolle<input v-model="newPath.targetRole" /></label>
            <label>Horisont<input v-model="newPath.horizon" /></label>
            <label>Beskrivelse<textarea v-model="newPath.description" /></label>
            <div class="path-line">
              <span>NTNU KI</span>
              <span v-for="company in selectedCompanies" :key="company.id">
                {{ company.name }}
                <button type="button" class="mini" @click="removeFromPath(company.id)">x</button>
              </span>
            </div>
            <button class="primary" :disabled="savingPath || selectedCompanies.length === 0" @click="savePath">Lagre custom path</button>
          </article>
        </div>
      </section>

      <section v-if="page === 'paths'" class="stack">
        <article class="panel" v-for="path in paths" :key="path.id">
          <div class="path-header">
            <div>
              <h2>{{ path.name }}</h2>
              <p>{{ path.description }}</p>
              <small>{{ path.targetRole }} - {{ path.horizon }}</small>
            </div>
            <div class="actions">
              <button type="button" class="secondary" @click="duplicatePath(path)">Dupliser</button>
              <button type="button" class="ghost danger" @click="removePath(path.id)">Slett</button>
            </div>
          </div>
          <div class="path-line saved">
            <span>NTNU KI</span>
            <span v-for="step in path.steps" :key="step.id">{{ step.company?.name ?? step.companyId }}</span>
          </div>
        </article>
      </section>
    </section>
  </div>
</template>
