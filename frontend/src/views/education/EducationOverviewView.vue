<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useEducationBachelorStore } from "../../stores/educationBachelor.js";
import { useEducationBooksStore } from "../../stores/educationBooks.js";
import { useEducationPlatformsStore } from "../../stores/educationPlatforms.js";
import { useEducationSelfStudyStore } from "../../stores/educationSelfStudy.js";

const selfStudyStore = useEducationSelfStudyStore();
const booksStore = useEducationBooksStore();
const platformsStore = useEducationPlatformsStore();
const bachelorStore = useEducationBachelorStore();

const sections = [
  { to: "/education/kurs", label: "Kurs", count: () => selfStudyStore.courses.length, hint: "Selvstudium og eksterne kurs" },
  { to: "/education/boker", label: "Bøker", count: () => booksStore.books.length, hint: "Bøker du leser eller har lest" },
  { to: "/education/plattformer", label: "Plattformer", count: () => platformsStore.platforms.length, hint: "Coursera, YouTube, osv." },
  { to: "/education/bachelor", label: "Bachelor-lærdom", count: () => bachelorStore.entries.length, hint: "Fag og tema fra bachelor" }
];
</script>

<template>
  <section class="grid three">
    <RouterLink v-for="section in sections" :key="section.to" :to="section.to" class="panel strong education-link">
      <h2>{{ section.label }}</h2>
      <strong>{{ section.count() }}</strong>
      <p>{{ section.hint }}</p>
    </RouterLink>
    <article class="panel wide">
      <h2>Om Utdanning</h2>
      <p>Logg det du lærer på egenhånd over tid — adskilt fra Master Plan som planlegger NTNU semester 7–10.</p>
    </article>
  </section>
</template>
