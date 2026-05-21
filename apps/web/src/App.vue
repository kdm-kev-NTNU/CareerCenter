<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { CareerMapNode, CareerPath, CareerTrack, Company, CoursePlan, CourseStatus } from "@careercenter/shared";
import { trackLabels } from "@careercenter/shared";
import { api, type CoursePayload, type PathPayload } from "./api";

type Page = "dashboard" | "master" | "map" | "companies" | "paths";

const page = ref<Page>("dashboard");
const error = ref("");
const courses = ref<CoursePlan[]>([]);
const companies = ref<Company[]>([]);
const paths = ref<CareerPath[]>([]);
const mapNodes = ref<CareerMapNode[]>([]);
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
  horizon: "5+ år",
  steps: []
});

const semesters = [7, 8, 9, 10] as const;
const statuses: CourseStatus[] = ["planned", "considering", "confirmed", "completed"];
const tracks = Object.keys(trackLabels) as CareerTrack[];
const visibleMapNodes = computed(() => mapNodes.value.filter((node) => !mapTrack.value || node.track === mapTrack.value || node.level === 0));
const recommendedCompanies = computed(() => companies.value.slice(0, 5));

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

async function addCourse() {
  const created = await api.createCourse({ ...newCourse.value, sortOrder: courses.value.length });
  courses.value.push(created);
  newCourse.value = { semester: newCourse.value.semester, courseCode: "", title: "", credits: 7.5, status: "planned", notes: "", trackTags: ["ENERGY_QUANT"], sortOrder: 0 };
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
  const payload = {
    ...newPath.value,
    steps: selectedCompanies.value.map((company, index) => ({
      companyId: company.id,
      order: index,
      note: index === 0 ? "Første sterke signal" : "",
      targetRole: newPath.value.targetRole
    }))
  };
  const created = await api.createPath(payload);
  paths.value.unshift(created);
  savingPath.value = false;
}

async function duplicatePath(path: CareerPath) {
  const created = await api.createPath({
    name: `${path.name} kopi`,
    description: path.description,
    targetRole: path.targetRole,
    horizon: path.horizon,
    steps: path.steps.map((step, index) => ({ companyId: step.companyId, order: index, note: step.note, targetRole: step.targetRole }))
  });
  paths.value.unshift(created);
}

async function removePath(id: string) {
  await api.deletePath(id);
  paths.value = paths.value.filter((path) => path.id !== id);
}

onMounted(async () => {
  try {
    const map = await api.careerMap();
    mapNodes.value = map.nodes;
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
          <small>Énbruker-base</small>
        </div>
      </div>
      <nav>
        <button :class="{ active: page === 'dashboard' }" @click="page = 'dashboard'">Dashboard</button>
        <button :class="{ active: page === 'master' }" @click="page = 'master'">Master Plan</button>
        <button :class="{ active: page === 'map' }" @click="page = 'map'">Karrierekart</button>
        <button :class="{ active: page === 'companies' }" @click="page = 'companies'">Bedrifter</button>
        <button :class="{ active: page === 'paths' }" @click="page = 'paths'">Custom Paths</button>
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
          <p>Start med 3-5 selskaper i én path og knytt fagvalgene til samme spor.</p>
        </article>
        <article class="panel wide">
          <h2>Høyest relevans akkurat nå</h2>
          <div class="company-row" v-for="company in recommendedCompanies" :key="company.id">
            <span>{{ company.name }}</span>
            <small>{{ company.geography }} · score {{ company.relevanceScore }}</small>
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
          <label>Spor<select v-model="newCourse.trackTags[0]"><option v-for="track in tracks" :key="track" :value="track">{{ trackLabels[track] }}</option></select></label>
          <label class="wide-field">Notater<textarea v-model="newCourse.notes" placeholder="Hvorfor faget passer pathen" /></label>
          <button class="primary" type="submit">Legg til fag</button>
        </form>

        <div class="semester-grid">
          <article class="panel" v-for="semester in semesters" :key="semester">
            <h2>Semester {{ semester }}</h2>
            <div v-for="course in courses.filter((item) => item.semester === semester)" :key="course.id" class="course-card">
              <div>
                <strong>{{ course.courseCode }} · {{ course.title }}</strong>
                <small>{{ course.credits }} stp · {{ course.status }} · {{ course.trackTags.map((track) => trackLabels[track]).join(", ") }}</small>
                <p>{{ course.notes }}</p>
              </div>
              <button class="icon" aria-label="Slett fag" @click="removeCourse(course.id)">×</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="page === 'map'" class="stack">
        <div class="toolbar">
          <button :class="{ active: !mapTrack }" @click="mapTrack = ''">Alle spor</button>
          <button v-for="track in tracks.slice(0, 3)" :key="track" :class="{ active: mapTrack === track }" @click="mapTrack = track">{{ trackLabels[track] }}</button>
        </div>
        <div class="map">
          <article v-for="node in visibleMapNodes" :key="node.id" class="map-node" :class="`level-${node.level}`">
            <h2>{{ node.title }}</h2>
            <ul>
              <li v-for="item in node.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section v-if="page === 'companies' || page === 'paths'" class="stack">
        <div class="panel filters">
          <input v-model="search" placeholder="Søk etter selskap, rolle eller geografi" @input="loadPublicData" />
          <select v-model="trackFilter" @change="loadPublicData">
            <option value="">Alle spor</option>
            <option v-for="track in tracks" :key="track" :value="track">{{ trackLabels[track] }}</option>
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
                <small>Tier {{ company.tier }} · {{ company.geography }} · {{ company.difficulty }} · score {{ company.relevanceScore }}</small>
              </div>
              <button class="secondary" @click="addToPath(company)">Legg til</button>
            </div>
          </article>

          <article class="panel builder">
            <h2>Path builder</h2>
            <label>Navn<input v-model="newPath.name" /></label>
            <label>Målrolle<input v-model="newPath.targetRole" /></label>
            <label>Horisont<input v-model="newPath.horizon" /></label>
            <label>Beskrivelse<textarea v-model="newPath.description" /></label>
            <div class="path-line">
              <span>NTNU KI</span>
              <span v-for="company in selectedCompanies" :key="company.id">
                {{ company.name }}
                <button class="mini" @click="removeFromPath(company.id)">×</button>
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
              <small>{{ path.targetRole }} · {{ path.horizon }}</small>
            </div>
            <div class="actions">
              <button class="secondary" @click="duplicatePath(path)">Dupliser</button>
              <button class="ghost danger" @click="removePath(path.id)">Slett</button>
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
