import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { careerTrackDefaults } from "@careercenter/shared";
import { api } from "../api/index.js";
import MasterPlanView from "./MasterPlanView.vue";
import { useCoursesStore } from "../stores/courses.js";

vi.mock("../api/index.js", () => ({
  api: {
    courses: vi.fn(),
    createCourse: vi.fn(),
    deleteCourse: vi.fn(),
    tracks: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe("MasterPlanView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedApi.courses.mockResolvedValue([
      {
        id: "c1",
        semester: 7,
        courseCode: "TDT4173",
        title: "Machine Learning",
        credits: 7.5,
        status: "planned",
        notes: "Core course",
        trackTags: ["ENERGY_QUANT"],
        sortOrder: 0
      }
    ]);
    mockedApi.tracks.mockResolvedValue(careerTrackDefaults);
  });

  async function mountView() {
    const pinia = createPinia();
    setActivePinia(pinia);
    await useCoursesStore().loadCourses();
    const wrapper = mount(MasterPlanView, { global: { plugins: [pinia] } });
    await flushPromises();
    return wrapper;
  }

  it("renders the master plan form and semester courses", async () => {
    const wrapper = await mountView();
    expect(wrapper.text()).toContain("Legg til fag");
    expect(wrapper.text()).toContain("TDT4173");
    expect(wrapper.text()).toContain("Semester 7");
  });

  it("submits a new course through the store", async () => {
    mockedApi.createCourse.mockResolvedValue({
      id: "c2",
      semester: 8,
      courseCode: "TDT4300",
      title: "Data Science",
      credits: 7.5,
      status: "planned",
      notes: "",
      trackTags: ["ENERGY_QUANT"],
      sortOrder: 1
    });

    const wrapper = await mountView();
    await wrapper.get('input[placeholder="TDT4173"]').setValue("TDT4300");
    await wrapper.get('input[placeholder="Machine Learning"]').setValue("Data Science");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mockedApi.createCourse).toHaveBeenCalled();
  });
});
