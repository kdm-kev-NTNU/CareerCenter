import { getActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { useAppStore } from "../stores/app.js";
import EducationLayout from "../components/education/EducationLayout.vue";
import InterviewLayout from "../components/interview/InterviewLayout.vue";
import AppShell from "../components/layout/AppShell.vue";
import DashboardView from "../views/DashboardView.vue";
import EducationAiResourcesView from "../views/education/EducationAiResourcesView.vue";
import EducationBachelorView from "../views/education/EducationBachelorView.vue";
import EducationBooksView from "../views/education/EducationBooksView.vue";
import EducationCoursesView from "../views/education/EducationCoursesView.vue";
import EducationOverviewView from "../views/education/EducationOverviewView.vue";
import InterviewOverviewView from "../views/interview/InterviewOverviewView.vue";
import InterviewBibelView from "../views/interview/InterviewBibelView.vue";
import InterviewPlanNewView from "../views/interview/InterviewPlanNewView.vue";
import InterviewPlanView from "../views/interview/InterviewPlanView.vue";
import InterviewSimulatorView from "../views/interview/InterviewSimulatorView.vue";
import InterviewVideoView from "../views/interview/InterviewVideoView.vue";
import AbilityTestsView from "../views/interview/AbilityTestsView.vue";
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
        },
        {
          path: "interview",
          component: InterviewLayout,
          meta: { title: "Intervju" },
          children: [
            {
              path: "",
              name: "interview-overview",
              component: InterviewOverviewView,
              meta: { title: "Intervju" }
            },
            {
              path: "bibel",
              name: "interview-bibel",
              component: InterviewBibelView,
              meta: { title: "Intervjubibel" }
            },
            {
              path: "plan/ny",
              name: "interview-plan-new",
              component: InterviewPlanNewView,
              meta: { title: "Ny plan" }
            },
            {
              path: "plan/:id",
              name: "interview-plan",
              component: InterviewPlanView,
              meta: { title: "Forberedelsesplan" }
            },
            {
              path: "simulator",
              name: "interview-simulator",
              component: InterviewSimulatorView,
              meta: { title: "Simulator" }
            },
            {
              path: "video",
              name: "interview-video",
              component: InterviewVideoView,
              meta: { title: "Videosøknad" }
            },
            {
              path: "evnetester",
              name: "interview-ability",
              component: AbilityTestsView,
              meta: { title: "Evnetester" }
            },
            {
              path: "struktur",
              redirect: { name: "interview-overview" }
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
