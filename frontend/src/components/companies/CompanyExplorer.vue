<script setup lang="ts">
import { ref } from "vue";
import ListingToolbar from "../listing/ListingToolbar.vue";
import CompanyFormModal from "./CompanyFormModal.vue";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useCompaniesStore } from "../../stores/companies.js";
import { usePathsStore } from "../../stores/paths.js";

const careerMapStore = useCareerMapStore();
const companiesStore = useCompaniesStore();
const pathsStore = usePathsStore();
const modalOpen = ref(false);

function openAddModal() {
  companiesStore.resetForm();
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}
</script>

<template>
  <section class="stack">
    <ListingToolbar @add="openAddModal">
      <template #filters>
        <input
          v-model="companiesStore.search"
          placeholder="Sok etter selskap, rolle eller geografi"
          @input="companiesStore.loadCompanies()"
        />
        <select v-model="companiesStore.trackFilter" @change="companiesStore.loadCompanies()">
          <option value="">Alle spor</option>
          <option v-for="track in careerMapStore.tracks" :key="track" :value="track">
            {{ careerMapStore.trackName(track) }}
          </option>
        </select>
        <select v-model="companiesStore.tierFilter" @change="companiesStore.loadCompanies()">
          <option value="">Alle tiers</option>
          <option value="1">Tier 1 Norge-start</option>
          <option value="2">Tier 2 Norden/Europa</option>
          <option value="3">Tier 3 global elite</option>
        </select>
      </template>
    </ListingToolbar>

    <div class="grid two">
      <article class="panel company-list">
        <h2>Bedrifter</h2>
        <p v-if="companiesStore.companies.length === 0" class="listing-empty">
          Ingen treff — legg til en ny bedrift.
        </p>
        <div v-for="company in companiesStore.companies" :key="company.id" class="company-card">
          <div>
            <strong>{{ company.name }}</strong>
            <p>{{ company.description }}</p>
            <small>Tier {{ company.tier }} - {{ company.geography }} - {{ company.difficulty }} - score {{ company.relevanceScore }}</small>
          </div>
          <button type="button" class="secondary" @click="pathsStore.addToPath(company)">Legg til</button>
        </div>
      </article>

      <article class="panel builder">
        <h2>Path builder</h2>
        <label>Navn<input v-model="pathsStore.newPath.name" /></label>
        <label>Malrolle<input v-model="pathsStore.newPath.targetRole" /></label>
        <label>Horisont<input v-model="pathsStore.newPath.horizon" /></label>
        <label>Beskrivelse<textarea v-model="pathsStore.newPath.description" /></label>
        <div class="path-line">
          <span>NTNU KI</span>
          <span v-for="company in pathsStore.selectedCompanies" :key="company.id">
            {{ company.name }}
            <button type="button" class="mini" @click="pathsStore.removeFromPath(company.id)">x</button>
          </span>
        </div>
        <button
          class="primary"
          :disabled="pathsStore.savingPath || pathsStore.selectedCompanies.length === 0"
          @click="pathsStore.savePath()"
        >
          Lagre custom path
        </button>
      </article>
    </div>

    <CompanyFormModal :open="modalOpen" @close="closeModal" @saved="closeModal" />
  </section>
</template>
