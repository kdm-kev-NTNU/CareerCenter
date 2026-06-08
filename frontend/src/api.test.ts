import type { CareerTrack } from "@careercenter/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./api/auth.js";
import {
  competitionsApi,
  educationApi,
  graduateProgramSettingsApi,
  graduateProgramsApi,
  internshipSettingsApi,
  internshipsApi
} from "./api/index.js";
import { api } from "./api/index.js";

const jsonResponse = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
  ...init
});

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets a JSON content type when sending a body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "course-1" }));

    await api.createCourse({
      semester: 7,
      courseCode: "TDT4173",
      title: "Machine Learning",
      credits: 7.5,
      status: "planned",
      notes: "",
      trackTags: ["ENERGY_QUANT"],
      sortOrder: 0
    });

    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("does not send a JSON content type for empty DELETE requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await api.deleteCourse("course-1");

    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Headers).has("content-type")).toBe(false);
  });

  it("parses JSON error messages from failed uploads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Mappe finnes ikke." }, { status: 422 })
    );

    await expect(
      educationApi.uploadBachelorFile(new File(["x"], "notes.pdf"), "missing-folder")
    ).rejects.toThrow("Mappe finnes ikke.");
  });

  it("builds GET and PUT requests for all API resources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse([])));

    await api.tracks();
    await api.courses();
    await api.updateCourse("course-1", {
      semester: 7,
      courseCode: "TDT4173",
      title: "Machine Learning",
      credits: 7.5,
      status: "planned",
      notes: "",
      trackTags: ["ENERGY_QUANT"],
      sortOrder: 0
    });
    await api.createCourse({
      semester: 8,
      courseCode: "TDT4171",
      title: "AI Methods",
      credits: 7.5,
      status: "confirmed",
      notes: "",
      trackTags: ["AI_CONSULTING"],
      sortOrder: 1
    });
    await api.deleteCourse("course-1");
    await api.updateTrack("ENERGY_QUANT", { label: "Energy & Quant" });
    await api.resetTrack("ENERGY_QUANT");
    await api.deleteTrack("ENERGY_QUANT");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/career-tracks",
      "/api/courses",
      "/api/courses/course-1",
      "/api/courses",
      "/api/courses/course-1",
      "/api/career-tracks/ENERGY_QUANT",
      "/api/career-tracks/ENERGY_QUANT/reset",
      "/api/career-tracks/ENERGY_QUANT"
    ]);
    expect(fetchMock.mock.calls[2][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[4][1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls[5][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[6][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[7][1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("throws response text for failed requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Kurs ikke funnet.", { status: 404 }));

    await expect(api.deleteCourse("missing")).rejects.toThrow("Kurs ikke funnet.");
  });

  it("throws a default message when a failed request has no response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    await expect(api.courses()).rejects.toThrow("Request failed: 500");
  });

  it("throws parsed JSON message for failed requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Ugyldig forespørsel." }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(api.courses()).rejects.toThrow("Ugyldig forespørsel.");
  });

  it("builds requests for competitions, listings, education, and auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      if (init?.body instanceof FormData) {
        const file = init.body.get("file");
        if (file instanceof File && file.name === "bad.pdf") {
          return Promise.resolve(new Response("Upload failed", { status: 400 }));
        }
        return Promise.resolve(jsonResponse({ id: "file-1", name: "notes.pdf" }));
      }
      if (typeof url === "string" && url.endsWith("/logout")) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (typeof url === "string" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse({ id: "item-1" }));
    });

    const catalogLabel = { label: "Test", sortOrder: 0 };
    const internshipPayload = {
      companyName: "Statkraft",
      title: "Intern",
      description: "",
      applicationUrl: "",
      notes: "",
      statusId: "status-1",
      locationIds: [] as string[],
      trackTags: ["ENERGY_QUANT"] as CareerTrack[],
      requirements: []
    };
    const selfStudyPayload = {
      title: "Course",
      provider: "Coursera",
      status: "planned" as const,
      notes: "",
      sortOrder: 0
    };

    await competitionsApi.competitions();
    await competitionsApi.createCompetition({
      title: "Junction",
      type: "hackathon",
      scope: "NORDICS",
      format: "hybrid",
      startDate: "2026-11-14",
      endDate: "2026-11-16",
      registrationDeadline: "2026-10-01",
      location: "Helsinki",
      organizer: "Junction",
      url: "https://junction.com",
      status: "considering",
      notes: "",
      sortOrder: 0
    });
    await competitionsApi.updateCompetition("comp-1", {
      title: "Junction",
      type: "hackathon",
      scope: "NORDICS",
      format: "hybrid",
      startDate: "2026-11-14",
      endDate: "2026-11-16",
      registrationDeadline: "2026-10-01",
      location: "Helsinki",
      organizer: "Junction",
      url: "https://junction.com",
      status: "considering",
      notes: "Updated",
      sortOrder: 0
    });
    await competitionsApi.deleteCompetition("comp-1");

    await internshipsApi.internships({
      q: "Statkraft",
      statusId: "status-1",
      locationId: "loc-1",
      track: "ENERGY_QUANT"
    });
    await internshipsApi.createInternship(internshipPayload);
    await internshipsApi.updateInternship("intern-1", internshipPayload);
    await internshipsApi.deleteInternship("intern-1");

    await internshipSettingsApi.settings();
    await internshipSettingsApi.createStatus(catalogLabel);
    await internshipSettingsApi.updateStatus("status-1", catalogLabel);
    await internshipSettingsApi.deleteStatus("status-1");
    await internshipSettingsApi.createLocation(catalogLabel);
    await internshipSettingsApi.updateLocation("loc-1", catalogLabel);
    await internshipSettingsApi.deleteLocation("loc-1");
    await internshipSettingsApi.createRequirementType(catalogLabel);
    await internshipSettingsApi.updateRequirementType("req-1", catalogLabel);
    await internshipSettingsApi.deleteRequirementType("req-1");

    await graduateProgramsApi.graduatePrograms({
      q: "NBIM",
      statusId: "status-1",
      locationId: "loc-1",
      track: "INVESTMENT_TECH"
    });
    const graduatePayload = {
      companyName: "NBIM",
      title: "Graduate",
      description: "",
      applicationUrl: "",
      notes: "",
      statusId: "status-1",
      locationIds: [] as string[],
      trackTags: ["INVESTMENT_TECH"] as CareerTrack[],
      requirements: []
    };
    await graduateProgramsApi.createGraduateProgram(graduatePayload);
    await graduateProgramsApi.updateGraduateProgram("gp-1", graduatePayload);
    await graduateProgramsApi.deleteGraduateProgram("gp-1");

    await graduateProgramSettingsApi.graduateProgramSettings();
    await graduateProgramSettingsApi.createGraduateProgramStatus(catalogLabel);
    await graduateProgramSettingsApi.updateGraduateProgramStatus("status-1", catalogLabel);
    await graduateProgramSettingsApi.deleteGraduateProgramStatus("status-1");
    await graduateProgramSettingsApi.createGraduateProgramLocation(catalogLabel);
    await graduateProgramSettingsApi.updateGraduateProgramLocation("loc-1", catalogLabel);
    await graduateProgramSettingsApi.deleteGraduateProgramLocation("loc-1");
    await graduateProgramSettingsApi.createGraduateProgramRequirementType(catalogLabel);
    await graduateProgramSettingsApi.updateGraduateProgramRequirementType("req-1", catalogLabel);
    await graduateProgramSettingsApi.deleteGraduateProgramRequirementType("req-1");

    await educationApi.selfStudyCourses();
    await educationApi.createSelfStudyCourse(selfStudyPayload);
    await educationApi.updateSelfStudyCourse("course-1", selfStudyPayload);
    await educationApi.deleteSelfStudyCourse("course-1");
    await educationApi.educationBooks();
    await educationApi.createEducationBook({
      title: "Book",
      status: "planned",
      notes: "",
      sortOrder: 0
    });
    await educationApi.updateEducationBook("book-1", {
      title: "Book",
      status: "planned",
      notes: "Updated",
      sortOrder: 0
    });
    await educationApi.deleteEducationBook("book-1");
    await educationApi.learningPlatforms();
    await educationApi.createLearningPlatform({
      name: "Coursera",
      notes: "",
      isActive: true,
      sortOrder: 0
    });
    await educationApi.updateLearningPlatform("platform-1", {
      name: "Coursera",
      notes: "Updated",
      isActive: true,
      sortOrder: 0
    });
    await educationApi.deleteLearningPlatform("platform-1");
    await educationApi.aiResources();
    await educationApi.aiResources("?target=codex");
    await educationApi.createAiResource({
      name: "AGENTS",
      kind: "codex_instruction",
      targetTools: ["codex"],
      status: "active",
      tags: ["codex"],
      installPath: "AGENTS.md",
      content: "# Instructions",
      frontmatter: {},
      configFormat: "markdown",
      notes: "",
      folderPath: "AI Agents/Skills",
      isStarred: false,
      usageCount: 0,
      lastUsedAt: null
    });
    await educationApi.updateAiResource("ai-1", {
      name: "AGENTS",
      kind: "codex_instruction",
      targetTools: ["codex"],
      status: "active",
      tags: ["codex"],
      installPath: "AGENTS.md",
      content: "# Instructions updated",
      frontmatter: {},
      configFormat: "markdown",
      notes: "Updated",
      folderPath: "AI Agents/Skills",
      isStarred: true,
      usageCount: 2,
      lastUsedAt: null
    });
    await educationApi.importAiResources({ files: [{ fileName: "AGENTS.md", content: "# Instructions" }] });
    await educationApi.exportAiResources("codex");
    await educationApi.markAiResourceUsed("ai-1");
    await educationApi.deleteAiResource("ai-1");
    await educationApi.bachelorKnowledge();
    await educationApi.bachelorKnowledge(null);
    await educationApi.bachelorKnowledge("folder-1");
    await educationApi.createBachelorKnowledge({
      folderId: "folder-1",
      courseName: "TDT4120",
      topic: "Algoritmer",
      notes: "",
      sortOrder: 0
    });
    await educationApi.updateBachelorKnowledge("bk-1", {
      folderId: "folder-1",
      courseName: "TDT4120",
      topic: "Algoritmer",
      notes: "Updated",
      sortOrder: 0
    });
    await educationApi.deleteBachelorKnowledge("bk-1");
    await educationApi.bachelorFolderTree();
    await educationApi.createBachelorFolder({ name: "Algo", parentId: null, sortOrder: 0 });
    await educationApi.updateBachelorFolder("folder-1", { name: "Algo II", parentId: null, sortOrder: 0 });
    await educationApi.deleteBachelorFolder("folder-1");
    await educationApi.bachelorFiles(null);
    await educationApi.uploadBachelorFile(new File(["x"], "notes.pdf"), "folder-1", "notes");
    await educationApi.updateBachelorFile("file-1", { notes: "Updated" });
    await educationApi.deleteBachelorFile("file-1");
    expect(educationApi.bachelorFileDownloadUrl("file-1")).toBe("/api/education/bachelor/files/file-1/download");

    await authApi.me();
    await authApi.register("Kevin", "1234");
    await authApi.login("Kevin", "1234");
    await authApi.logout();

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("/api/competitions");
    expect(urls.some((url) => typeof url === "string" && url.startsWith("/api/internships?"))).toBe(true);
    expect(urls).toContain("/api/education/bachelor/files");
    expect(urls).toContain("/api/education/ai-resources");
    expect(urls).toContain("/api/education/ai-resources/import");
    expect(urls).toContain("/api/education/ai-resources/export?target=codex");
    expect(urls).toContain("/api/auth/me");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });
});
