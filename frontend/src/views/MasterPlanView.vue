<script setup lang="ts">
import type { CourseStatus } from "@careercenter/shared";
import { useCareerMapStore } from "../stores/careerMap.js";
import { useCoursesStore } from "../stores/courses.js";

const coursesStore = useCoursesStore();
const careerMapStore = useCareerMapStore();

const semesters = [7, 8, 9, 10] as const;
const statuses: CourseStatus[] = ["planned", "considering", "confirmed", "completed"];
</script>

<template>
  <section class="stack">
    <form class="panel form-grid" @submit.prevent="coursesStore.addCourse()">
      <label>Semester<select v-model.number="coursesStore.newCourse.semester"><option v-for="semester in semesters" :key="semester" :value="semester">Semester {{ semester }}</option></select></label>
      <label>Fagkode<input v-model="coursesStore.newCourse.courseCode" placeholder="TDT4173" required /></label>
      <label>Tittel<input v-model="coursesStore.newCourse.title" placeholder="Machine Learning" required /></label>
      <label>Studiepoeng<input v-model.number="coursesStore.newCourse.credits" type="number" step="0.5" /></label>
      <label>Status<select v-model="coursesStore.newCourse.status"><option v-for="status in statuses" :key="status">{{ status }}</option></select></label>
      <label class="wide-field">Notater<textarea v-model="coursesStore.newCourse.notes" placeholder="Hvorfor faget passer pathen" /></label>
      <button class="primary" type="submit">Legg til fag</button>
    </form>

    <div class="semester-grid">
      <article class="panel" v-for="semester in semesters" :key="semester">
        <h2>Semester {{ semester }}</h2>
        <div v-for="course in coursesStore.courses.filter((item) => item.semester === semester)" :key="course.id" class="course-card">
          <div>
            <strong>{{ course.courseCode }} - {{ course.title }}</strong>
            <small>{{ course.credits }} stp - {{ course.status }} - {{ course.trackTags.map((track) => careerMapStore.trackName(track)).join(", ") }}</small>
            <p>{{ course.notes }}</p>
          </div>
          <button type="button" class="icon" aria-label="Slett fag" @click="coursesStore.removeCourse(course.id)">x</button>
        </div>
      </article>
    </div>
  </section>
</template>
