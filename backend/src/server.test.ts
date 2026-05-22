import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./memoryRepository.js";
import { buildServer } from "./server.js";

async function createTestApp() {
  const app = await buildServer({ repository: new MemoryRepository(), authDisabled: true });
  await app.ready();
  return app;
}

const pathPayload = (name: string) => ({
  name,
  description: "NTNU til global commodity trading",
  targetRole: "Quantitative Analyst",
  horizon: "5+ years",
  steps: [
    { companyId: "statkraft", order: 0, note: "Norsk start", targetRole: "Data Scientist" },
    { companyId: "incommodities", order: 1, note: "Algo trading", targetRole: "Algo Trader" }
  ]
});

describe("CareerCenter API", () => {
  it("registers, logs in, returns me, and logs out", async () => {
    const app = await buildServer({ repository: new MemoryRepository() });

    const registered = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Kevin", pin: "1234" }
    });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().name).toBe("Kevin");
    const registerCookie = registered.cookies.find((cookie) => cookie.name === "token");
    expect(registerCookie?.httpOnly).toBe(true);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { token: registerCookie!.value }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().name).toBe("Kevin");

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { token: registerCookie!.value }
    });
    expect(logout.statusCode).toBe(204);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { name: "Kevin", pin: "1234" }
    });
    expect(login.statusCode).toBe(200);

    await app.close();
  });

  it("creates, lists and deletes competitions for the single app user", async () => {
    const app = await createTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/competitions",
      payload: {
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
        notes: "Case track",
        sortOrder: 0
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().title).toBe("Junction");

    const list = await app.inject({ method: "GET", url: "/api/competitions" });
    expect(list.json()).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/competitions/${created.json().id}` });
    expect(deleted.statusCode).toBe(204);

    const afterDelete = await app.inject({ method: "GET", url: "/api/competitions" });
    expect(afterDelete.json()).toHaveLength(0);

    await app.close();
  });

  it("creates and lists courses for the single app user", async () => {
    const app = await createTestApp();

    const createCourse = await app.inject({
      method: "POST",
      url: "/api/courses",
      payload: { semester: 7, courseCode: "TDT4173", title: "Machine Learning", credits: 7.5, status: "planned", notes: "Relevant for quant", trackTags: ["ENERGY_QUANT"], sortOrder: 0 }
    });
    expect(createCourse.statusCode).toBe(200);

    const courses = await app.inject({ method: "GET", url: "/api/courses" });
    expect(courses.json()).toHaveLength(1);

    await app.close();
  });

  it("searches companies and creates a custom path", async () => {
    const app = await createTestApp();

    const companies = await app.inject({ method: "GET", url: "/api/companies?q=Statkraft&track=ENERGY_QUANT" });
    expect(companies.json()[0].name).toBe("Statkraft");

    const created = await app.inject({
      method: "POST",
      url: "/api/paths",
      payload: {
        ...pathPayload("Energy Quant-ruten"),
        steps: [...pathPayload("Energy Quant-ruten").steps, { companyId: "vitol", order: 2, note: "Global elite", targetRole: "Quant Analyst" }]
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().steps.map((step: any) => step.company.name)).toEqual(["Statkraft", "InCommodities", "Vitol"]);

    await app.close();
  });

  it("deletes a custom path and removes it from future lists", async () => {
    const app = await createTestApp();

    const first = await app.inject({ method: "POST", url: "/api/paths", payload: pathPayload("Delete me") });
    const second = await app.inject({ method: "POST", url: "/api/paths", payload: pathPayload("Keep me") });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const deleted = await app.inject({ method: "DELETE", url: `/api/paths/${first.json().id}` });
    expect(deleted.statusCode).toBe(204);

    const paths = await app.inject({ method: "GET", url: "/api/paths" });
    expect(paths.json().map((path: any) => path.name)).toEqual(["Keep me"]);

    await app.close();
  });

  it("returns 404 when deleting an unknown custom path", async () => {
    const app = await createTestApp();

    const deleted = await app.inject({ method: "DELETE", url: "/api/paths/missing-path" });
    expect(deleted.statusCode).toBe(404);
    expect(deleted.json()).toEqual({ message: "Path ikke funnet." });

    await app.close();
  });

  it("returns 404 for unknown updates and course deletes", async () => {
    const app = await createTestApp();

    const missingCourseUpdate = await app.inject({
      method: "PUT",
      url: "/api/courses/missing-course",
      payload: { semester: 7, courseCode: "TDT4173", title: "Machine Learning", credits: 7.5, status: "planned", notes: "", trackTags: ["ENERGY_QUANT"], sortOrder: 0 }
    });
    expect(missingCourseUpdate.statusCode).toBe(404);

    const missingCourseDelete = await app.inject({ method: "DELETE", url: "/api/courses/missing-course" });
    expect(missingCourseDelete.statusCode).toBe(404);

    const missingPathUpdate = await app.inject({ method: "PUT", url: "/api/paths/missing-path", payload: pathPayload("Missing") });
    expect(missingPathUpdate.statusCode).toBe(404);

    const missingPathGet = await app.inject({ method: "GET", url: "/api/paths/missing-path" });
    expect(missingPathGet.statusCode).toBe(404);

    await app.close();
  });

  it("filters companies by tier and geography", async () => {
    const app = await createTestApp();

    const companies = await app.inject({ method: "GET", url: "/api/companies?tier=1&geography=Norge" });
    expect(companies.json().every((company: any) => company.tier === 1 && company.geography.includes("Norge"))).toBe(true);

    await app.close();
  });

  it("returns career map nodes and track settings", async () => {
    const app = await createTestApp();

    const map = await app.inject({ method: "GET", url: "/api/career-map" });
    expect(map.statusCode).toBe(200);
    expect(map.json().nodes.some((node: any) => node.id === "energy-1")).toBe(true);
    expect(map.json().tracks.some((track: any) => track.id === "ENERGY_QUANT")).toBe(true);

    await app.close();
  });

  it("updates and resets a career map node", async () => {
    const app = await createTestApp();

    const updated = await app.inject({
      method: "PUT",
      url: "/api/career-map/nodes/energy-1",
      payload: { title: "Spor A nivå 1 (redigert)", items: ["Statkraft", "Equinor"] }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().title).toBe("Spor A nivå 1 (redigert)");
    expect(updated.json().items).toEqual(["Statkraft", "Equinor"]);

    const reset = await app.inject({ method: "POST", url: "/api/career-map/nodes/energy-1/reset" });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().title).toBe("Spor A nivå 1: Norge, 0-3 år");

    await app.close();
  });

  it("returns 404 when updating or resetting an unknown career map node", async () => {
    const app = await createTestApp();

    const updated = await app.inject({
      method: "PUT",
      url: "/api/career-map/nodes/missing-node",
      payload: { title: "Missing", items: ["Statkraft"] }
    });
    expect(updated.statusCode).toBe(404);

    const reset = await app.inject({ method: "POST", url: "/api/career-map/nodes/missing-node/reset" });
    expect(reset.statusCode).toBe(404);
    expect(reset.json()).toEqual({ message: "Node ikke funnet." });

    await app.close();
  });

  it("updates and resets a career track label", async () => {
    const app = await createTestApp();

    const updated = await app.inject({
      method: "PUT",
      url: "/api/career-tracks/ENERGY_QUANT",
      payload: { label: "Energy & Quant (redigert)" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().label).toBe("Energy & Quant (redigert)");

    const reset = await app.inject({ method: "POST", url: "/api/career-tracks/ENERGY_QUANT/reset" });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().label).toBe("Energy, Power Trading & Quant");

    await app.close();
  });

  it("deletes a career track and blocks deleting the last track", async () => {
    const app = await createTestApp();

    const trackIds = ["ENERGY_QUANT", "AI_CONSULTING", "VENTURE_PE_AI_OPS", "INVESTMENT_TECH", "INDUSTRIAL_AI"];
    for (let i = 0; i < trackIds.length - 1; i++) {
      const deleted = await app.inject({ method: "DELETE", url: `/api/career-tracks/${trackIds[i]}` });
      expect(deleted.statusCode).toBe(204);
    }

    const list = await app.inject({ method: "GET", url: "/api/career-tracks" });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].id).toBe("INDUSTRIAL_AI");

    const blocked = await app.inject({ method: "DELETE", url: "/api/career-tracks/INDUSTRIAL_AI" });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({ message: "Du må ha minst ett spor." });

    await app.close();
  });

  it("creates internship settings, internship entry, and deletes it", async () => {
    const app = await createTestApp();

    const settings = await app.inject({ method: "GET", url: "/api/internship-settings" });
    expect(settings.statusCode).toBe(200);
    const statusId = settings.json().statuses[0].id;
    const locationId = settings.json().locations[0].id;

    const created = await app.inject({
      method: "POST",
      url: "/api/internships",
      payload: {
        companyName: "Statkraft",
        title: "Summer Intern Technology",
        description: "Spennende tech internship",
        applicationUrl: "https://example.com/apply",
        notes: "Søk tidlig",
        deadline: "2026-06-01",
        statusId,
        locationIds: [locationId],
        trackTags: ["ENERGY_QUANT"],
        requirements: settings.json().requirementTypes.slice(0, 2).map((type: { id: string }) => ({
          requirementTypeId: type.id,
          isRequired: true,
          isDone: true,
          notes: ""
        }))
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().companyName).toBe("Statkraft");
    expect(created.json().requirements.filter((item: { isDone: boolean }) => item.isDone)).toHaveLength(2);

    const list = await app.inject({ method: "GET", url: "/api/internships?q=Statkraft" });
    expect(list.json()).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/internships/${created.json().id}` });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });

  it("creates graduate program settings, graduate program entry, and deletes it", async () => {
    const app = await createTestApp();

    const settings = await app.inject({ method: "GET", url: "/api/graduate-program-settings" });
    expect(settings.statusCode).toBe(200);
    const statusId = settings.json().statuses[0].id;
    const locationId = settings.json().locations[0].id;

    const created = await app.inject({
      method: "POST",
      url: "/api/graduate-programs",
      payload: {
        companyId: "nbim",
        companyName: "NBIM",
        title: "Technology Graduate Programme",
        description: "Investment tech graduate track",
        applicationUrl: "https://example.com/graduate",
        notes: "Søk tidlig",
        deadline: "2026-10-01",
        statusId,
        locationIds: [locationId],
        trackTags: ["INVESTMENT_TECH"],
        requirements: settings.json().requirementTypes.slice(0, 1).map((type: { id: string }) => ({
          requirementTypeId: type.id,
          isRequired: true,
          isDone: true,
          notes: ""
        }))
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().companyName).toBe("NBIM");
    expect(created.json().requirements.filter((item: { isDone: boolean }) => item.isDone)).toHaveLength(1);

    const list = await app.inject({ method: "GET", url: "/api/graduate-programs?q=NBIM" });
    expect(list.json()).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/graduate-programs/${created.json().id}` });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });

  it("blocks deleting graduate program status in use", async () => {
    const app = await createTestApp();
    const settings = await app.inject({ method: "GET", url: "/api/graduate-program-settings" });
    const statusId = settings.json().statuses[0].id;

    const created = await app.inject({
      method: "POST",
      url: "/api/graduate-programs",
      payload: {
        companyName: "Equinor",
        title: "Graduate Programme",
        statusId,
        locationIds: [],
        trackTags: [],
        requirements: []
      }
    });
    expect(created.statusCode).toBe(200);

    const deleted = await app.inject({ method: "DELETE", url: `/api/graduate-program-settings/statuses/${statusId}` });
    expect(deleted.statusCode).toBe(409);

    await app.close();
  });

  it("blocks deleting internship status in use", async () => {
    const app = await createTestApp();
    const settings = await app.inject({ method: "GET", url: "/api/internship-settings" });
    const statusId = settings.json().statuses[0].id;

    const created = await app.inject({
      method: "POST",
      url: "/api/internships",
      payload: {
        companyName: "NBIM",
        title: "Intern",
        statusId,
        locationIds: [],
        trackTags: [],
        requirements: []
      }
    });
    expect(created.statusCode).toBe(200);

    const deleted = await app.inject({ method: "DELETE", url: `/api/internship-settings/statuses/${statusId}` });
    expect(deleted.statusCode).toBe(409);

    await app.close();
  });

  it("returns 404 for unknown career track ids", async () => {
    const app = await createTestApp();

    const updated = await app.inject({
      method: "PUT",
      url: "/api/career-tracks/UNKNOWN_TRACK",
      payload: { label: "Missing" }
    });
    expect(updated.statusCode).toBe(404);
    expect(updated.json()).toEqual({ message: "Spor ikke funnet." });

    const reset = await app.inject({ method: "POST", url: "/api/career-tracks/UNKNOWN_TRACK/reset" });
    expect(reset.statusCode).toBe(404);

    const deleted = await app.inject({ method: "DELETE", url: "/api/career-tracks/UNKNOWN_TRACK" });
    expect(deleted.statusCode).toBe(404);

    await app.close();
  });

  it("creates, updates, duplicates, and deletes career boards", async () => {
    const app = await createTestApp();

    const list = await app.inject({ method: "GET", url: "/api/boards" });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((board: { isDefault: boolean }) => board.isDefault)).toBe(true);

    const defaultBoard = list.json().find((board: { isDefault: boolean }) => board.isDefault);
    const fetched = await app.inject({ method: "GET", url: `/api/boards/${defaultBoard.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().graph.nodes.length).toBeGreaterThan(0);

    const created = await app.inject({
      method: "POST",
      url: "/api/boards",
      payload: { name: "Plan B", description: "Alternativ rute" }
    });
    expect(created.statusCode).toBe(200);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/boards/${created.json().id}`,
      payload: {
        graph: {
          nodes: [{ id: "n1", type: "milestone", position: { x: 0, y: 0 }, data: { label: "Start" } }],
          edges: []
        }
      }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().graph.nodes).toHaveLength(1);

    const duplicated = await app.inject({ method: "POST", url: `/api/boards/${created.json().id}/duplicate` });
    expect(duplicated.statusCode).toBe(200);
    expect(duplicated.json().name).toContain("kopi");

    const deleted = await app.inject({ method: "DELETE", url: `/api/boards/${created.json().id}` });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });

  it("creates and lists self-study courses under education", async () => {
    const app = await createTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/education/courses",
      payload: {
        title: "Deep Learning Specialization",
        provider: "Coursera",
        status: "in_progress",
        url: "https://www.coursera.org",
        notes: "Modul 2",
        sortOrder: 0
      }
    });
    expect(created.statusCode).toBe(200);

    const courses = await app.inject({ method: "GET", url: "/api/education/courses" });
    expect(courses.json()).toHaveLength(1);
    expect(courses.json()[0].title).toBe("Deep Learning Specialization");

    await app.close();
  });

  it("creates bachelor folders and lists folder tree", async () => {
    const app = await createTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/folders",
      payload: { name: "Algoritmer", parentId: null, sortOrder: 0 }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().name).toBe("Algoritmer");

    const tree = await app.inject({ method: "GET", url: "/api/education/bachelor/folders?tree=true" });
    expect(tree.statusCode).toBe(200);
    expect(tree.json()).toHaveLength(1);
    expect(tree.json()[0].children).toEqual([]);

    const files = await app.inject({ method: "GET", url: "/api/education/bachelor/files?folderId=" });
    expect(files.statusCode).toBe(200);
    expect(files.json()).toEqual([]);

    await app.close();
  });

  it("creates a company and finds it via search", async () => {
    const app = await createTestApp();

    const payload = {
      name: "NyBedrift AS",
      description: "Testbedrift for API",
      tracks: ["ENERGY_QUANT"],
      tier: 2,
      geography: "Trondheim",
      roleTypes: ["Data Scientist"],
      difficulty: "High",
      upside: "Very high",
      relevanceScore: 75,
      websiteUrl: "https://example.com"
    };

    const created = await app.inject({ method: "POST", url: "/api/companies", payload });
    expect(created.statusCode).toBe(200);
    expect(created.json().name).toBe("NyBedrift AS");

    const search = await app.inject({ method: "GET", url: "/api/companies?q=NyBedrift" });
    expect(search.json().some((company: { name: string }) => company.name === "NyBedrift AS")).toBe(true);

    const duplicate = await app.inject({ method: "POST", url: "/api/companies", payload });
    expect(duplicate.statusCode).toBe(409);

    await app.close();
  });
});
