import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { careerTrackDefaults } from "@careercenter/shared";
import { api } from "../api/index.js";
import MasterPlanView from "./MasterPlanView.vue";
import { useCoursesStore } from "../stores/courses.js";
import { useCareerMapStore } from "../stores/careerMap.js";

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
    vi.clearAllMocks();
    mockedApi.tracks.mockResolvedValue(careerTrackDefaults);
    mockedApi.courses.mockResolvedValue([]);
  });

  async function mountWithCourses(coursesData: any[] = []) {
    const pinia = createPinia();
    setActivePinia(pinia);

    mockedApi.courses.mockResolvedValue(coursesData);

    const coursesStore = useCoursesStore();
    const careerMapStore = useCareerMapStore();

    await careerMapStore.setTracks(careerTrackDefaults);
    await coursesStore.loadCourses();
    await flushPromises();

    const wrapper = mount(MasterPlanView, {
      global: { plugins: [pinia] }
    });
    await flushPromises();

    return { wrapper, coursesStore, careerMapStore };
  }

  describe("Form rendering", () => {
    it("renders the form with all required fields", async () => {
      const { wrapper } = await mountWithCourses();

      expect(wrapper.find("form").exists()).toBe(true);
      expect(wrapper.find("select").exists()).toBe(true);
      expect(wrapper.findAll("input").length).toBeGreaterThanOrEqual(3);
      expect(wrapper.find("input[placeholder='TDT4173']").exists()).toBe(true);
      expect(wrapper.find("input[placeholder='Machine Learning']").exists()).toBe(true);
      expect(wrapper.find("input[type='number']").exists()).toBe(true);
      expect(wrapper.findAll("select").length).toBeGreaterThanOrEqual(2);
      expect(wrapper.find("textarea").exists()).toBe(true);
      expect(wrapper.find("textarea[placeholder='Hvorfor faget passer pathen']").exists()).toBe(true);
      expect(wrapper.find("button[type='submit']").text()).toContain("Legg til fag");
    });

    it("renders all semester options (7, 8, 9, 10)", async () => {
      const { wrapper } = await mountWithCourses();
      const options = wrapper.find("select").findAll("option");

      expect(options.length).toBe(4);
      expect(options[0].text()).toBe("Semester 7");
      expect(options[1].text()).toBe("Semester 8");
      expect(options[2].text()).toBe("Semester 9");
      expect(options[3].text()).toBe("Semester 10");
    });

    it("renders all status options", async () => {
      const { wrapper } = await mountWithCourses();
      const options = wrapper.findAll("select")[1].findAll("option");

      expect(options.length).toBe(4);
      expect(options[0].text()).toBe("planned");
      expect(options[1].text()).toBe("considering");
      expect(options[2].text()).toBe("confirmed");
      expect(options[3].text()).toBe("completed");
    });
  });

  describe("Form submission", () => {
    it("calls addCourse when form is submitted", async () => {
      mockedApi.createCourse.mockResolvedValue({
        id: "c-new",
        semester: 7,
        courseCode: "",
        title: "",
        credits: 7.5,
        status: "planned",
        notes: "",
        trackTags: ["ENERGY_QUANT"],
        sortOrder: 0
      });

      const { wrapper, coursesStore } = await mountWithCourses();
      const spy = vi.spyOn(coursesStore, 'addCourse').mockImplementation(async () => {
        const created = await mockedApi.createCourse({ ...coursesStore.newCourse, sortOrder: 0 });
        coursesStore.courses.push(created);
      });

      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("creates a new course with form data", async () => {
      mockedApi.createCourse.mockResolvedValue({
        id: "c-new",
        semester: 7,
        courseCode: "TDT1000",
        title: "Data Science",
        credits: 7.5,
        status: "planned",
        notes: "Test notes",
        trackTags: ["ENERGY_QUANT"],
        sortOrder: 0
      });

      const { wrapper, coursesStore } = await mountWithCourses();

      await wrapper.find('input[placeholder="TDT4173"]').setValue("TDT1000");
      await wrapper.find('input[placeholder="Machine Learning"]').setValue("Data Science");
      await wrapper.find("textarea").setValue("Test notes");

      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(mockedApi.createCourse).toHaveBeenCalledWith(expect.objectContaining({
        courseCode: "TDT1000",
        title: "Data Science",
        notes: "Test notes"
      }));
      expect(coursesStore.courses).toHaveLength(1);
    });
  });

  describe("Course display", () => {
    it("displays courses grouped by semester", async () => {
      const { wrapper } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4173",
          title: "Machine Learning",
          credits: 7.5,
          status: "planned",
          notes: "",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 0
        },
        {
          id: "c2",
          semester: 8,
          courseCode: "TDT4175",
          title: "Deep Learning",
          credits: 7.5,
          status: "considering",
          notes: "",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 1
        }
      ]);

      const headings = wrapper.findAll("h2");
      expect(headings.map((h) => h.text())).toEqual([
        "Semester 7", "Semester 8", "Semester 9", "Semester 10"
      ]);

      expect(wrapper.findAll(".course-card").length).toBe(2);
    });

    it("displays course information correctly", async () => {
      const { wrapper, careerMapStore } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4173",
          title: "Machine Learning",
          credits: 7.5,
          status: "planned",
          notes: "Important course",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 0
        }
      ]);

      expect(wrapper.text()).toContain("TDT4173 - Machine Learning");
      expect(wrapper.text()).toContain("7.5 stp - planned");
      expect(wrapper.text()).toContain("Important course");
      expect(wrapper.text()).toContain(careerMapStore.trackName("ENERGY_QUANT"));
    });

    it("displays multiple track tags joined by comma", async () => {
      const { wrapper, careerMapStore } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4175",
          title: "Advanced AI",
          credits: 7.5,
          status: "confirmed",
          notes: "",
          trackTags: ["ENERGY_QUANT", "AI_CONSULTING"],
          sortOrder: 0
        }
      ]);

      const t1 = careerMapStore.trackName("ENERGY_QUANT");
      const t2 = careerMapStore.trackName("AI_CONSULTING");
      expect(wrapper.text()).toContain(`${t1}, ${t2}`);
    });

    it("filters courses correctly by semester", async () => {
      const { wrapper } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4100",
          title: "OOP",
          credits: 7.5,
          status: "completed",
          notes: "",
          trackTags: [],
          sortOrder: 0
        },
        {
          id: "c2",
          semester: 7,
          courseCode: "TDT4173",
          title: "ML",
          credits: 7.5,
          status: "planned",
          notes: "",
          trackTags: [],
          sortOrder: 1
        },
        {
          id: "c3",
          semester: 9,
          courseCode: "TDT4501",
          title: "Thesis",
          credits: 30,
          status: "planned",
          notes: "",
          trackTags: [],
          sortOrder: 2
        }
      ]);

      expect(wrapper.findAll("article").length).toBe(4);
      expect(wrapper.findAll(".course-card").length).toBe(3);
      expect(wrapper.text()).toContain("TDT4100");
      expect(wrapper.text()).toContain("TDT4173");
      expect(wrapper.text()).toContain("TDT4501");
      expect(wrapper.text()).toContain("30 stp");
    });
  });

  describe("Course deletion", () => {
    it("calls removeCourse when delete button is clicked", async () => {
      mockedApi.deleteCourse.mockResolvedValue(undefined);

      const { wrapper, coursesStore } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4173",
          title: "Machine Learning",
          credits: 7.5,
          status: "planned",
          notes: "",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 0
        }
      ]);

      const deleteBtn = wrapper.find("button[aria-label='Slett fag']");
      expect(deleteBtn.exists()).toBe(true);
      expect(deleteBtn.text()).toBe("x");

      await deleteBtn.trigger("click");
      await flushPromises();

      expect(mockedApi.deleteCourse).toHaveBeenCalledWith("c1");
      expect(coursesStore.courses).toHaveLength(0);
    });

    it("has correct accessibility label on delete button", async () => {
      const { wrapper } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4173",
          title: "Machine Learning",
          credits: 7.5,
          status: "planned",
          notes: "",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 0
        }
      ]);

      expect(wrapper.find("button[aria-label='Slett fag']").exists()).toBe(true);
    });
  });

  describe("Empty semester display", () => {
    it("renders article containers for all semesters even when empty", async () => {
      const { wrapper } = await mountWithCourses();
      expect(wrapper.findAll("article").length).toBe(4);
    });

    it("shows semester headings in empty articles", async () => {
      const { wrapper } = await mountWithCourses();
      expect(wrapper.findAll("h2").map((h) => h.text())).toEqual([
        "Semester 7", "Semester 8", "Semester 9", "Semester 10"
      ]);
    });

    it("does not render course cards when no courses in semester", async () => {
      const { wrapper } = await mountWithCourses([]);
      expect(wrapper.findAll("article").length).toBe(4);
      expect(wrapper.findAll(".course-card").length).toBe(0);
    });

    it("renders mixed semesters with and without courses", async () => {
      const { wrapper } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4100",
          title: "Course in semester 7",
          credits: 7.5,
          status: "completed",
          notes: "",
          trackTags: [],
          sortOrder: 0
        },
        {
          id: "c2",
          semester: 9,
          courseCode: "TDT4501",
          title: "Course in semester 9",
          credits: 30,
          status: "planned",
          notes: "",
          trackTags: [],
          sortOrder: 1
        }
      ]);

      expect(wrapper.findAll("article").length).toBe(4);
      expect(wrapper.findAll(".course-card").length).toBe(2);
    });
  });

  describe("Component structure", () => {
    it("has correct CSS classes for styling", async () => {
      const { wrapper } = await mountWithCourses();

      expect(wrapper.find("section.stack").exists()).toBe(true);
      expect(wrapper.find("form.panel.form-grid").exists()).toBe(true);
      expect(wrapper.find("div.semester-grid").exists()).toBe(true);
      expect(wrapper.find("article.panel").exists()).toBe(true);
    });

    it("has primary class on submit button", async () => {
      const { wrapper } = await mountWithCourses();
      expect(wrapper.find("button[type='submit']").classes()).toContain("primary");
    });

    it("has icon class on delete buttons", async () => {
      const { wrapper } = await mountWithCourses([
        {
          id: "c1",
          semester: 7,
          courseCode: "TDT4173",
          title: "Machine Learning",
          credits: 7.5,
          status: "planned",
          notes: "",
          trackTags: ["ENERGY_QUANT"],
          sortOrder: 0
        }
      ]);

      expect(wrapper.find("button[aria-label='Slett fag']").classes()).toContain("icon");
    });
  });

  describe("Notes textarea", () => {
    it("has wide-field class on notes label", async () => {
      const { wrapper } = await mountWithCourses();

      const notesLabel = wrapper.findAll("label").find((label) =>
        label.text().includes("Notater")
      );

      expect(notesLabel).toBeDefined();
      expect(notesLabel!.classes()).toContain("wide-field");
    });
  });

  describe("Two-way binding", () => {
    it("updates newCourse when form inputs change", async () => {
      const { wrapper, coursesStore } = await mountWithCourses();

      await wrapper.find('input[placeholder="TDT4173"]').setValue("TDT1000");
      expect(coursesStore.newCourse.courseCode).toBe("TDT1000");

      await wrapper.find('input[placeholder="Machine Learning"]').setValue("Data Science");
      expect(coursesStore.newCourse.title).toBe("Data Science");

      await wrapper.find("textarea").setValue("Test notes");
      expect(coursesStore.newCourse.notes).toBe("Test notes");
    });

    it("updates semester when select changes", async () => {
      const { wrapper, coursesStore } = await mountWithCourses();
      await wrapper.find("select").setValue("9");
      expect(coursesStore.newCourse.semester).toBe(9);
    });

    it("updates status when select changes", async () => {
      const { wrapper, coursesStore } = await mountWithCourses();
      await wrapper.findAll("select")[1].setValue("confirmed");
      expect(coursesStore.newCourse.status).toBe("confirmed");
    });

    it("updates credits when number input changes", async () => {
      const { wrapper, coursesStore } = await mountWithCourses();
      await wrapper.find("input[type='number']").setValue("15");
      expect(coursesStore.newCourse.credits).toBe(15);
    });
  });
});
