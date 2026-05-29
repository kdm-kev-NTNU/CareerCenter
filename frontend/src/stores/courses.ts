import { defineStore } from "pinia";
import { ref } from "vue";
import type { CoursePlan } from "@careercenter/shared";
import { api, type CoursePayload } from "../api/index.js";

function courseToPayload(course: CoursePlan): CoursePayload {
  return {
    semester: course.semester,
    courseCode: course.courseCode,
    title: course.title,
    credits: course.credits,
    status: course.status,
    notes: course.notes,
    trackTags: course.trackTags,
    sortOrder: course.sortOrder
  };
}

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

  async function updateCourseNotes(id: string, notes: string) {
    const course = courses.value.find((item) => item.id === id);
    if (!course) return;
    const updated = await api.updateCourse(id, { ...courseToPayload(course), notes });
    const index = courses.value.findIndex((item) => item.id === id);
    if (index >= 0) courses.value[index] = updated;
  }

  return { courses, newCourse, loadCourses, addCourse, removeCourse, updateCourseNotes };
});
