<script setup lang="ts">
import { ref } from "vue";
import ListingToolbar from "../listing/ListingToolbar.vue";
import CompanyFormModal from "./CompanyFormModal.vue";
import { useCareerMapStore } from "../../stores/careerMap.js";
import { useCompaniesStore } from "../../stores/companies.js";

const careerMapStore = useCareerMapStore();
const companiesStore = useCompaniesStore();
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
      </div>
    </article>

    <CompanyFormModal :open="modalOpen" @close="closeModal" @saved="closeModal" />
  </section>
</template>
