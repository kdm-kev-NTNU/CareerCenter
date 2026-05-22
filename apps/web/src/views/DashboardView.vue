<script setup lang="ts">
import { RouterLink } from "vue-router";
import { competitionScopeLabels } from "@careercenter/shared";
import { useCompaniesStore } from "../stores/companies.js";
import { useCompetitionsStore } from "../stores/competitions.js";
import { useCoursesStore } from "../stores/courses.js";
import { usePathsStore } from "../stores/paths.js";

const coursesStore = useCoursesStore();
const pathsStore = usePathsStore();
const companiesStore = useCompaniesStore();
const competitionsStore = useCompetitionsStore();

function formatUpcomingDate(value?: string): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("nb-NO");
}
</script>

<template>
  <section class="grid three">
    <article class="panel strong">
      <h2>Masterstatus</h2>
      <strong>{{ coursesStore.courses.length }}</strong>
      <p>fag er lagt inn for semester 7-10.</p>
    </article>
    <article class="panel strong">
      <h2>Lagrede paths</h2>
      <strong>{{ pathsStore.paths.length }}</strong>
      <p>custom paths er aktive i databasen.</p>
    </article>
    <article class="panel strong">
      <h2>Neste steg</h2>
      <p>Start med 3-5 selskaper i en path og knytt fagvalgene til samme spor.</p>
    </article>
    <article class="panel wide">
      <div class="panel-heading-row">
        <h2>Kommende hackathons og konkurranser</h2>
        <RouterLink to="/competitions">Se alle</RouterLink>
      </div>
      <p v-if="competitionsStore.upcomingCompetitions.length === 0">Ingen kommende arrangementer de neste 30 dagene.</p>
      <div
        v-for="entry in competitionsStore.upcomingCompetitions.slice(0, 5)"
        :key="entry.id"
        class="company-row"
      >
        <span>{{ entry.title }}</span>
        <small>
          {{ competitionScopeLabels[entry.scope] }} ·
          {{ formatUpcomingDate(entry.registrationDeadline ?? entry.startDate) }}
        </small>
      </div>
    </article>
    <article class="panel wide">
      <h2>Hoyest relevans akkurat na</h2>
      <div class="company-row" v-for="company in companiesStore.recommendedCompanies" :key="company.id">
        <span>{{ company.name }}</span>
        <small>{{ company.geography }} - score {{ company.relevanceScore }}</small>
      </div>
    </article>
  </section>
</template>
