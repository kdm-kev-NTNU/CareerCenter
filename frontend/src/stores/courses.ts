import { defineStore } from "pinia";
import { ref } from "vue";
import type { CoursePlan } from "@careercenter/shared";
import { api, type CoursePayload } from "../api/index.js";

export const useCoursesStore = defineStore("courses", () => {
  const courses = ref<CoursePlan[]>([]);
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

  async function loadCourses() {
    courses.value = await api.courses();
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

  return { courses, newCourse, loadCourses, addCourse, removeCourse };
});
