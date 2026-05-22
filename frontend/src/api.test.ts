import type { CareerTrack } from "@careercenter/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./api/auth.js";
import {
  boardsApi,
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: "path-1" }));

    await api.createPath({
      name: "Energy Quant-ruten",
      description: "",
      targetRole: "Quant",
      horizon: "5+ years",
      steps: []
    });

    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Headers).get("content-type")).toBe("application/json");
  });

  it("does not send a JSON content type for empty DELETE requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    await api.deletePath("path-1");

    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Headers).has("content-type")).toBe(false);
  });

  it("builds GET and PUT requests for all API resources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(jsonResponse([])));

    await api.careerMap();
    await api.companies("?q=Statkraft");
    await api.createCompany({
      name: "NyBedrift AS",
      description: "Test",
      tracks: ["ENERGY_QUANT"],
      tier: 1,
      geography: "Oslo",
      roleTypes: ["Data Scientist"],
      difficulty: "High",
      upside: "High",
      relevanceScore: 80
    });
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
    await api.paths();
    await api.updatePath("path-1", {
      name: "Energy Quant-ruten",
      description: "",
      targetRole: "Quant",
      horizon: "5+ years",
      steps: []
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
    await api.updateMapNode("energy-1", { title: "Spor A", items: ["Statkraft"] });
    await api.resetMapNode("energy-1");
    await api.tracks();
    await api.updateTrack("ENERGY_QUANT", { label: "Energy & Quant" });
    await api.resetTrack("ENERGY_QUANT");
    await api.deleteTrack("ENERGY_QUANT");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/career-map",
      "/api/companies?q=Statkraft",
      "/api/companies",
      "/api/courses",
      "/api/courses/course-1",
      "/api/paths",
      "/api/paths/path-1",
      "/api/courses",
      "/api/courses/course-1",
      "/api/career-map/nodes/energy-1",
      "/api/career-map/nodes/energy-1/reset",
      "/api/career-tracks",
      "/api/career-tracks/ENERGY_QUANT",
      "/api/career-tracks/ENERGY_QUANT/reset",
      "/api/career-tracks/ENERGY_QUANT"
    ]);
    expect(fetchMock.mock.calls[4][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[6][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[7][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[8][1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls[9][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[10][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[12][1]?.method).toBe("PUT");
    expect(fetchMock.mock.calls[13][1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[14][1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });

  it("throws response text for failed requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Path ikke funnet.", { status: 404 }));

    await expect(api.deletePath("missing")).rejects.toThrow("Path ikke funnet.");
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

  it("builds requests for boards, competitions, listings, education, and auth", async () => {
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

    await boardsApi.boards();
    await boardsApi.board("board-1");
    await boardsApi.createBoard({ name: "Plan B" });
    await boardsApi.updateBoard("board-1", { name: "Plan B+" });
    await boardsApi.duplicateBoard("board-1");
    await boardsApi.deleteBoard("board-1");

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
    await educationApi.deleteSelfStudyCourse("course-1");
    await educationApi.educationBooks();
    await educationApi.createEducationBook({
      title: "Book",
      status: "planned",
      notes: "",
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
    await educationApi.deleteLearningPlatform("platform-1");
    await educationApi.bachelorKnowledge();
    await educationApi.createBachelorKnowledge({
      courseName: "TDT4120",
      topic: "Algoritmer",
      notes: "",
      sortOrder: 0
    });
    await educationApi.deleteBachelorKnowledge("bk-1");
    await educationApi.bachelorFolderTree();
    await educationApi.createBachelorFolder({ name: "Algo", parentId: null, sortOrder: 0 });
    await educationApi.updateBachelorFolder("folder-1", { name: "Algo II", parentId: null, sortOrder: 0 });
    await educationApi.deleteBachelorFolder("folder-1");
    await educationApi.bachelorFiles(null);
    await educationApi.uploadBachelorFile(new File(["x"], "notes.pdf"), "folder-1", "notes");
    await expect(
      educationApi.uploadBachelorFile(new File(["x"], "bad.pdf"), null)
    ).rejects.toThrow("Upload failed");
    await educationApi.updateBachelorFile("file-1", { notes: "Updated" });
    await educationApi.deleteBachelorFile("file-1");
    expect(educationApi.bachelorFileDownloadUrl("file-1")).toBe("/api/education/bachelor/files/file-1/download");

    await authApi.me();
    await authApi.register("Kevin", "1234");
    await authApi.login("Kevin", "1234");
    await authApi.logout();

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain("/api/boards");
    expect(urls).toContain("/api/competitions");
    expect(urls.some((url) => typeof url === "string" && url.startsWith("/api/internships?"))).toBe(true);
    expect(urls).toContain("/api/education/bachelor/files");
    expect(urls).toContain("/api/auth/me");
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === "include")).toBe(true);
  });
});
