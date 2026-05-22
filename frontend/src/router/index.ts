import { getActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import EducationLayout from "../components/education/EducationLayout.vue";
import AppShell from "../components/layout/AppShell.vue";
import CareerBoardView from "../views/CareerBoardView.vue";
import CompaniesView from "../views/CompaniesView.vue";
import DashboardView from "../views/DashboardView.vue";
import EducationBachelorView from "../views/education/EducationBachelorView.vue";
import EducationBooksView from "../views/education/EducationBooksView.vue";
import EducationCoursesView from "../views/education/EducationCoursesView.vue";
import EducationOverviewView from "../views/education/EducationOverviewView.vue";
import EducationPlatformsView from "../views/education/EducationPlatformsView.vue";
import LoginView from "../views/LoginView.vue";
import MasterPlanView from "../views/MasterPlanView.vue";
import PathsView from "../views/PathsView.vue";
import CompetitionsView from "../views/CompetitionsView.vue";
import GraduateProgramsView from "../views/GraduateProgramsView.vue";
import InternshipsView from "../views/InternshipsView.vue";
import { useAuthStore } from "../stores/auth.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { public: true, title: "Logg inn" }
    },
    {
      path: "/",
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "dashboard",
          component: DashboardView,
          meta: { title: "Dashboard" }
        },
        {
          path: "master",
          name: "master",
          component: MasterPlanView,
          meta: { title: "Master Plan" }
        },
        {
          path: "map",
          name: "map",
          component: CareerBoardView,
          meta: { title: "Karriereboard" }
        },
        {
          path: "companies",
          name: "companies",
          component: CompaniesView,
          meta: { title: "Bedriftsbase" }
        },
        {
          path: "paths",
          name: "paths",
          component: PathsView,
          meta: { title: "Custom Paths" }
        },
        {
          path: "internships",
          name: "internships",
          component: InternshipsView,
          meta: { title: "Internship" }
        },
        {
          path: "graduate",
          name: "graduate",
          component: GraduateProgramsView,
          meta: { title: "Graduate-programmer" }
        },
        {
          path: "competitions",
          name: "competitions",
          component: CompetitionsView,
          meta: { title: "Hackathons & konkurranser" }
        },
        {
          path: "education",
          component: EducationLayout,
          meta: { title: "Utdanning" },
          children: [
            {
              path: "",
              name: "education-overview",
              component: EducationOverviewView,
              meta: { title: "Utdanning" }
            },
            {
              path: "kurs",
              name: "education-courses",
              component: EducationCoursesView,
              meta: { title: "Kurs" }
            },
            {
              path: "boker",
              name: "education-books",
              component: EducationBooksView,
              meta: { title: "Bøker" }
            },
            {
              path: "plattformer",
              name: "education-platforms",
              component: EducationPlatformsView,
              meta: { title: "Plattformer" }
            },
            {
              path: "bachelor",
              name: "education-bachelor",
              component: EducationBachelorView,
              meta: { title: "Bachelor-lærdom" }
            }
          ]
        }
      ]
    }
  ]
});

router.beforeEach(async (to) => {
  const pinia = getActivePinia();
  if (!pinia) return true;

  const authStore = useAuthStore(pinia);
  await authStore.fetchMe();

  if (to.meta.public) {
    if (authStore.isAuthenticated && to.name === "login") {
      return { name: "dashboard" };
    }
    return true;
  }

  if (!authStore.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  return true;
});

export default router;
