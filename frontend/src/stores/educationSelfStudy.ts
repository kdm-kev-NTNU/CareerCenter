import { defineStore } from "pinia";
import { ref } from "vue";
import type { SelfStudyCourse } from "@careercenter/shared";
import { api } from "../api/index.js";
import type { SelfStudyCoursePayload } from "../types/index.js";

export const useEducationSelfStudyStore = defineStore("educationSelfStudy", () => {
  const courses = ref<SelfStudyCourse[]>([]);
  const newCourse = ref<SelfStudyCoursePayload>({
    title: "",
    provider: "",
    status: "planned",
    url: "",
    notes: "",
    sortOrder: 0
  });

  async function loadCourses() {
    courses.value = await api.selfStudyCourses();
  }

  async function addCourse() {
    const payload: SelfStudyCoursePayload = {
      ...newCourse.value,
      url: newCourse.value.url || undefined,
      sortOrder: courses.value.length
    };
    const created = await api.createSelfStudyCourse(payload);
    courses.value.push(created);
    newCourse.value = {
      title: "",
      provider: newCourse.value.provider,
      status: "planned",
      url: "",
      notes: "",
      sortOrder: 0
    };
  }

  async function removeCourse(id: string) {
    await api.deleteSelfStudyCourse(id);
    courses.value = courses.value.filter((course) => course.id !== id);
  }

  return { courses, newCourse, loadCourses, addCourse, removeCourse };
});
