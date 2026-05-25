import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api/index.js";
import { useCareerMapStore } from "./careerMap.js";
import { useCompaniesStore } from "./companies.js";
import { useCoursesStore } from "./courses.js";
import { usePathsStore } from "./paths.js";
import { useCompetitionsStore } from "./competitions.js";
import { useEducationBachelorStore } from "./educationBachelor.js";
import { useEducationBooksStore } from "./educationBooks.js";
import { useEducationPlatformsStore } from "./educationPlatforms.js";
import { useEducationSelfStudyStore } from "./educationSelfStudy.js";
import { useGraduateProgramSettingsStore } from "./graduateProgramSettings.js";
import { useGraduateProgramsStore } from "./graduatePrograms.js";
import { useInternshipSettingsStore } from "./internshipSettings.js";
import { useInternshipsStore } from "./internships.js";
import { useBoardStore } from "./board.js";

export const useAppStore = defineStore("app", () => {
  const error = ref("");
  const initialized = ref(false);
  const isInitializing = ref(false);

  function setError(message: string) {
    error.value = message;
  }

  function clearError() {
    error.value = "";
  }

  async function initialize() {
    isInitializing.value = true;
    localStorage.removeItem("careercenter-map-drafts");
    clearError();
    const careerMapStore = useCareerMapStore();
    const companiesStore = useCompaniesStore();
    const coursesStore = useCoursesStore();
    const pathsStore = usePathsStore();
    const competitionsStore = useCompetitionsStore();
    const internshipSettingsStore = useInternshipSettingsStore();
    const internshipsStore = useInternshipsStore();
    const graduateProgramSettingsStore = useGraduateProgramSettingsStore();
    const graduateProgramsStore = useGraduateProgramsStore();
    const educationSelfStudyStore = useEducationSelfStudyStore();
    const educationBooksStore = useEducationBooksStore();
    const educationPlatformsStore = useEducationPlatformsStore();
    const educationBachelorStore = useEducationBachelorStore();
    const boardStore = useBoardStore();

    try {
      const [tracks] = await Promise.all([
        api.tracks(),
        companiesStore.loadCompanies(),
        coursesStore.loadCourses(),
        pathsStore.loadPaths(),
        competitionsStore.loadCompetitions()
      ]);
      careerMapStore.setTracks(tracks);

      await Promise.all([
        internshipSettingsStore.loadSettings().then(() => {
          internshipsStore.syncFormFromSettings();
          return internshipsStore.loadInternships();
        }),
        graduateProgramSettingsStore.loadSettings().then(() => {
          graduateProgramsStore.syncFormFromSettings();
          return graduateProgramsStore.loadGraduatePrograms();
        })
      ]);

      await Promise.all([
        educationSelfStudyStore.loadCourses(),
        educationBooksStore.loadBooks(),
        educationPlatformsStore.loadPlatforms(),
        educationBachelorStore.loadAll(),
        boardStore.loadBoards()
      ]);
      initialized.value = true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kunne ikke laste appdata.");
    } finally {
      isInitializing.value = false;
    }
  }

  return { error, initialized, isInitializing, setError, clearError, initialize };
});
