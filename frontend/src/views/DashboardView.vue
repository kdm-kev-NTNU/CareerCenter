<script setup lang="ts">
import { RouterLink } from "vue-router";
import { competitionScopeLabels, thesisCompanyStatusLabels } from "@careercenter/shared";
import { useCompetitionsStore } from "../stores/competitions.js";
import { useCoursesStore } from "../stores/courses.js";
import { useGraduateProgramsStore } from "../stores/graduatePrograms.js";
import { useInternshipsStore } from "../stores/internships.js";
import { useThesisCompaniesStore } from "../stores/thesisCompanies.js";

const coursesStore = useCoursesStore();
const internshipsStore = useInternshipsStore();
const graduateProgramsStore = useGraduateProgramsStore();
const competitionsStore = useCompetitionsStore();
const thesisCompaniesStore = useThesisCompaniesStore();

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
      <h2>Muligheter</h2>
      <strong>{{ internshipsStore.internships.length + graduateProgramsStore.graduatePrograms.length }}</strong>
      <p>internship- og graduate-programmer er registrert.</p>
    </article>
    <article class="panel strong">
      <h2>Neste steg</h2>
      <p>Legg til internship eller graduate-programmer og følg opp søknadene dine.</p>
    </article>
    <article class="panel wide">
      <div class="panel-heading-row">
        <h2>Masteroppgave-bedrifter</h2>
        <RouterLink to="/master-thesis">Se alle</RouterLink>
      </div>
      <p v-if="thesisCompaniesStore.companies.length === 0">Ingen masteroppgave-bedrifter er registrert ennå.</p>
      <div
        v-for="entry in thesisCompaniesStore.companies.slice(0, 5)"
        :key="entry.id"
        class="company-row"
      >
        <span>{{ entry.companyName }}</span>
        <small>
          {{ thesisCompanyStatusLabels[entry.status] }}
          <template v-if="entry.topicArea"> · {{ entry.topicArea }}</template>
        </small>
      </div>
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
  </section>
</template>
