import { getActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { useAppStore } from "../stores/app.js";
import EducationLayout from "../components/education/EducationLayout.vue";
import AppShell from "../components/layout/AppShell.vue";
import DashboardView from "../views/DashboardView.vue";
import EducationAiResourcesView from "../views/education/EducationAiResourcesView.vue";
import EducationBachelorView from "../views/education/EducationBachelorView.vue";
import EducationBooksView from "../views/education/EducationBooksView.vue";
import EducationCoursesView from "../views/education/EducationCoursesView.vue";
import EducationOverviewView from "../views/education/EducationOverviewView.vue";
import EducationPlatformsView from "../views/education/EducationPlatformsView.vue";
import LoginView from "../views/LoginView.vue";
import ApplicationsView from "../views/ApplicationsView.vue";
import CompetitionsView from "../views/CompetitionsView.vue";
import ThesisCompaniesView from "../views/ThesisCompaniesView.vue";
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
          redirect: { name: "dashboard" }
        },
        {
          path: "soknader",
          name: "applications",
          component: ApplicationsView,
          meta: { title: "Søknader" }
        },
        {
          path: "internships",
          redirect: { name: "applications", query: { type: "internship" } }
        },
        {
          path: "graduate",
          redirect: { name: "applications", query: { type: "graduate" } }
        },
        {
          path: "master-thesis",
          name: "master-thesis",
          component: ThesisCompaniesView,
          meta: { title: "Masteroppgave" }
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
            },
            {
              path: "ai",
              name: "education-ai-resources",
              component: EducationAiResourcesView,
              meta: { title: "AI-ressurser" }
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

router.afterEach(() => {
  const pinia = getActivePinia();
  if (!pinia) return;
  useAppStore(pinia).clearError();
});

export default router;
