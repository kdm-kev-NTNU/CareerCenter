import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./memoryRepository.js";
import { buildServer } from "./server.js";

async function createTestApp() {
  const app = await buildServer({ repository: new MemoryRepository(), authDisabled: true });
  await app.ready();
  return app;
}

describe("CareerCenter API", () => {
  it("rejects login with wrong pin", async () => {
    const app = await buildServer({ repository: new MemoryRepository(), authDisabled: false });

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "WrongPinUser", pin: "1234" }
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { name: "WrongPinUser", pin: "9999" }
    });
    expect(login.statusCode).toBe(401);

    await app.close();
  });

  it("registers, logs in, returns me, and logs out", async () => {
    const app = await buildServer({ repository: new MemoryRepository(), authDisabled: false });

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

  it("returns me without a session cookie when auth is disabled", async () => {
    const app = await createTestApp();

    const me = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().name).toBe("__test__");

    await app.close();
  });

  it("updates and returns 404 for unknown competitions", async () => {
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

    const createdBody = created.json() as { id: string; title: string };
    const updated = await app.inject({
      method: "PUT",
      url: `/api/competitions/${createdBody.id}`,
      payload: { ...createdBody, title: "Junction (oppdatert)" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().title).toBe("Junction (oppdatert)");

    const missing = await app.inject({
      method: "PUT",
      url: "/api/competitions/missing",
      payload: created.json()
    });
    expect(missing.statusCode).toBe(404);

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

  it("searches companies by query and track", async () => {
    const app = await createTestApp();

    const companies = await app.inject({ method: "GET", url: "/api/companies?q=Statkraft&track=ENERGY_QUANT" });
    expect(companies.json()[0].name).toBe("Statkraft");

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

  it("creates bachelor knowledge linked to folders", async () => {
    const app = await createTestApp();

    const folder = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/folders",
      payload: { name: "Algoritmer", parentId: null, sortOrder: 0 }
    });
    const folderId = folder.json().id as string;

    const rootEntry = await app.inject({
      method: "POST",
      url: "/api/education/bachelor",
      payload: {
        folderId: null,
        courseName: "Generelt",
        topic: "Oversikt",
        notes: "Rot-notat",
        sortOrder: 0
      }
    });
    expect(rootEntry.statusCode).toBe(200);
    expect(rootEntry.json().folderId).toBeNull();

    const folderEntry = await app.inject({
      method: "POST",
      url: "/api/education/bachelor",
      payload: {
        folderId,
        courseName: "TDT4120",
        topic: "Heap",
        notes: "Prioritetskø",
        sortOrder: 0
      }
    });
    expect(folderEntry.statusCode).toBe(200);
    expect(folderEntry.json().folderId).toBe(folderId);

    const rootList = await app.inject({ method: "GET", url: "/api/education/bachelor?folderId=" });
    expect(rootList.json()).toHaveLength(1);
    expect(rootList.json()[0].topic).toBe("Oversikt");

    const folderList = await app.inject({
      method: "GET",
      url: `/api/education/bachelor?folderId=${encodeURIComponent(folderId)}`
    });
    expect(folderList.json()).toHaveLength(1);
    expect(folderList.json()[0].topic).toBe("Heap");

    const allList = await app.inject({ method: "GET", url: "/api/education/bachelor" });
    expect(allList.json()).toHaveLength(2);

    await app.close();
  });

  it("updates and deletes bachelor folders", async () => {
    const app = await createTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/folders",
      payload: { name: "Mappe A", parentId: null, sortOrder: 0 }
    });
    expect(created.statusCode).toBe(200);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/education/bachelor/folders/${created.json().id}`,
      payload: { name: "Mappe A (redigert)", parentId: null, sortOrder: 1 }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().name).toBe("Mappe A (redigert)");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/education/bachelor/folders/${created.json().id}`
    });
    expect(deleted.statusCode).toBe(204);

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

  it("uploads, updates, downloads, and deletes bachelor files", async () => {
    const app = await createTestApp();
    const boundary = "----CareerCenterBoundary";

    const upload = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload:
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="notes.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `hello bachelor\r\n` +
        `--${boundary}--\r\n`
    });
    expect(upload.statusCode).toBe(201);
    const fileId = upload.json().id as string;
    expect(upload.json().originalName).toBe("notes.txt");

    const updated = await app.inject({
      method: "PUT",
      url: `/api/education/bachelor/files/${fileId}`,
      payload: { notes: "Husk dette", originalName: "notes.txt" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().notes).toBe("Husk dette");

    const download = await app.inject({
      method: "GET",
      url: `/api/education/bachelor/files/${fileId}/download`
    });
    expect(download.statusCode).toBe(200);
    expect(download.body).toContain("hello bachelor");

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/education/bachelor/files/${fileId}`
    });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });

  it("rejects bachelor upload without multipart body", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/files",
      payload: { notes: "test" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Ingen fil mottatt.");
    await app.close();
  });

  it("rejects bachelor upload with missing file name", async () => {
    const app = await createTestApp();
    const boundary = "----CareerCenterBoundary";
    const response = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/files",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload:
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename=""\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `hello\r\n` +
        `--${boundary}--\r\n`
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Filnavn mangler.");
    await app.close();
  });

  it("rejects bachelor upload to missing folder", async () => {
    const app = await createTestApp();
    const boundary = "----CareerCenterBoundary";
    const response = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/files",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload:
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="folderId"\r\n\r\n` +
        `missing-folder\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="notes.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `hello bachelor\r\n` +
        `--${boundary}--\r\n`
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().message).toBe("Mappe finnes ikke.");
    await app.close();
  });

  it("returns 400 for invalid request bodies", async () => {
    const app = await createTestApp();

    const invalidCompany = await app.inject({
      method: "POST",
      url: "/api/companies",
      payload: { name: "" }
    });
    expect(invalidCompany.statusCode).toBe(400);
    expect(invalidCompany.json().message).toBe("Ugyldig forespørsel.");
    expect(invalidCompany.json().issues).toBeDefined();

    await app.close();
  });

  it("imports, filters, exports, updates, and deletes AI resources", async () => {
    const app = await createTestApp();

    const manual = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources",
      payload: {
        name: "Review checklist",
        kind: "workflow_checklist",
        targetTools: ["cursor", "codex"],
        status: "draft",
        tags: ["review"],
        installPath: "",
        content: "- Run tests",
        frontmatter: {},
        configFormat: "markdown",
        notes: ""
      }
    });
    expect(manual.statusCode, manual.body).toBe(200);

    const imported = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources/import",
      payload: {
        files: [
          {
            fileName: "tailwind.mdc",
            content: [
              "---",
              'description: "Tailwind component rules"',
              'globs: "**/*.vue"',
              "alwaysApply: false",
              "---",
              "# Tailwind",
              "Use existing utility patterns."
            ].join("\n")
          },
          { fileName: "AGENTS.md", content: "# Codex instructions\nRun typecheck before final handoff." },
          {
            fileName: "mcp.json",
            content: JSON.stringify({ mcpServers: { docs: { command: "npx", args: ["docs-mcp"], env: { API_KEY: "${API_KEY}" } } } })
          }
        ]
      }
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().created).toHaveLength(3);
    expect(imported.json().rejected).toHaveLength(0);

    const reimported = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources/import",
      payload: { files: [{ fileName: "AGENTS.md", content: "# Codex instructions\nUpdated." }] }
    });
    expect(reimported.statusCode).toBe(200);
    expect(reimported.json().updated).toHaveLength(1);

    const codexList = await app.inject({ method: "GET", url: "/api/education/ai-resources?target=codex" });
    expect(codexList.statusCode).toBe(200);
    expect(codexList.json().some((resource: { kind: string }) => resource.kind === "codex_instruction")).toBe(true);

    const cursorExport = await app.inject({ method: "GET", url: "/api/education/ai-resources/export?target=cursor" });
    expect(cursorExport.statusCode).toBe(200);
    expect(cursorExport.json().files.map((file: { path: string }) => file.path)).toContain(".cursor/rules/tailwind.mdc");
    expect(cursorExport.json().files.map((file: { path: string }) => file.path)).toContain(".cursor/mcp.json");
    expect(cursorExport.json().files.find((file: { path: string }) => file.path === ".cursor/mcp.json").writeStrategy).toBe("json_mcp_merge");

    const codexExport = await app.inject({ method: "GET", url: "/api/education/ai-resources/export?target=codex" });
    expect(codexExport.statusCode).toBe(200);
    expect(codexExport.json().files.map((file: { path: string }) => file.path)).toContain("AGENTS.md");
    expect(codexExport.json().files.map((file: { path: string }) => file.path)).toContain(".codex/config.toml");
    expect(codexExport.json().files.find((file: { path: string }) => file.path === "AGENTS.md").writeStrategy).toBe("managed_markdown_block");
    expect(codexExport.json().files.find((file: { path: string }) => file.path === ".codex/config.toml").writeStrategy).toBe("toml_managed_block");

    const missingUpdate = await app.inject({
      method: "PUT",
      url: "/api/education/ai-resources/missing",
      payload: {
        name: "Ghost",
        kind: "prompt_snippet",
        targetTools: ["codex"],
        status: "draft",
        tags: [],
        installPath: "",
        content: "Ghost",
        frontmatter: {},
        configFormat: "plain",
        notes: ""
      }
    });
    expect(missingUpdate.statusCode).toBe(404);

    const deleted = await app.inject({ method: "DELETE", url: `/api/education/ai-resources/${manual.json().id}` });
    expect(deleted.statusCode).toBe(204);

    await app.close();
  });

  it("creates education books and platforms and returns 404 for unknown ids", async () => {
    const app = await createTestApp();

    const book = await app.inject({
      method: "POST",
      url: "/api/education/books",
      payload: { title: "Designing Data-Intensive Applications", status: "planned", notes: "", sortOrder: 0 }
    });
    expect(book.statusCode).toBe(200);

    const platform = await app.inject({
      method: "POST",
      url: "/api/education/platforms",
      payload: { name: "Coursera", notes: "", isActive: true, sortOrder: 0 }
    });
    expect(platform.statusCode).toBe(200);

    const missingBookUpdate = await app.inject({
      method: "PUT",
      url: "/api/education/books/missing-book",
      payload: { title: "Ghost", status: "planned", notes: "", sortOrder: 0 }
    });
    expect(missingBookUpdate.statusCode).toBe(404);
    expect(missingBookUpdate.json()).toEqual({ message: "Bok ikke funnet." });

    const missingBookDelete = await app.inject({ method: "DELETE", url: "/api/education/books/missing-book" });
    expect(missingBookDelete.statusCode).toBe(404);

    const missingPlatformUpdate = await app.inject({
      method: "PUT",
      url: "/api/education/platforms/missing-platform",
      payload: { name: "Ghost", notes: "", isActive: true, sortOrder: 0 }
    });
    expect(missingPlatformUpdate.statusCode).toBe(404);
    expect(missingPlatformUpdate.json()).toEqual({ message: "Plattform ikke funnet." });

    const missingPlatformDelete = await app.inject({ method: "DELETE", url: "/api/education/platforms/missing-platform" });
    expect(missingPlatformDelete.statusCode).toBe(404);

    const updatedBook = await app.inject({
      method: "PUT",
      url: `/api/education/books/${book.json().id}`,
      payload: { title: "DDIA (2nd ed.)", status: "in_progress", notes: "Ongoing", sortOrder: 0 }
    });
    expect(updatedBook.statusCode).toBe(200);
    expect(updatedBook.json().title).toBe("DDIA (2nd ed.)");

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

  describe("graduate program listings", () => {
    async function loadGraduateSettings(app: Awaited<ReturnType<typeof createTestApp>>) {
      const settings = await app.inject({ method: "GET", url: "/api/graduate-program-settings" });
      expect(settings.statusCode).toBe(200);
      return settings.json() as {
        statuses: Array<{ id: string }>;
        locations: Array<{ id: string }>;
        requirementTypes: Array<{ id: string }>;
      };
    }

    it("rejects create with invalid statusId", async () => {
      const app = await createTestApp();
      const created = await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "Test AS",
          title: "Graduate",
          statusId: "missing-status",
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(422);
      expect(created.json().message).toBe("Ugyldig status.");
      await app.close();
    });

    it("rejects create with invalid companyId", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyId: "missing-company",
          companyName: "Test AS",
          title: "Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(422);
      expect(created.json().message).toBe("Ugyldig bedrift.");
      await app.close();
    });

    it("rejects create with empty required fields", async () => {
      const app = await createTestApp();
      const created = await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: { companyName: "", title: "", statusId: "", locationIds: [], trackTags: [], requirements: [] }
      });
      expect(created.statusCode).toBe(400);
      await app.close();
    });

    it("updates a graduate program", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "DNB",
          title: "Tech Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["INVESTMENT_TECH"],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(200);

      const updated = await app.inject({
        method: "PUT",
        url: `/api/graduate-programs/${created.json().id}`,
        payload: {
          companyName: "DNB",
          title: "Tech Graduate (oppdatert)",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["INVESTMENT_TECH"],
          requirements: []
        }
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().title).toBe("Tech Graduate (oppdatert)");
      await app.close();
    });

    it("returns 404 when updating unknown graduate program", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const updated = await app.inject({
        method: "PUT",
        url: "/api/graduate-programs/missing-id",
        payload: {
          companyName: "DNB",
          title: "Ghost",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(updated.statusCode).toBe(404);
      await app.close();
    });

    it("filters graduate programs by status, location, track and search", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "Equinor",
          title: "Energy Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"],
          requirements: []
        }
      });
      await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "NBIM",
          title: "Investment Graduate",
          statusId: settings.statuses[1]?.id ?? settings.statuses[0].id,
          locationIds: settings.locations[1] ? [settings.locations[1].id] : [],
          trackTags: ["INVESTMENT_TECH"],
          requirements: []
        }
      });

      const bySearch = await app.inject({ method: "GET", url: "/api/graduate-programs?q=Equinor" });
      expect(bySearch.json()).toHaveLength(1);

      const byStatus = await app.inject({
        method: "GET",
        url: `/api/graduate-programs?statusId=${settings.statuses[0].id}`
      });
      expect(byStatus.json().every((item: { statusId: string }) => item.statusId === settings.statuses[0].id)).toBe(true);

      const byTrack = await app.inject({ method: "GET", url: "/api/graduate-programs?track=INVESTMENT_TECH" });
      expect(byTrack.json()).toHaveLength(1);

      await app.close();
    });

    it("manages graduate program settings catalog", async () => {
      const app = await createTestApp();
      const location = await app.inject({
        method: "POST",
        url: "/api/graduate-program-settings/locations",
        payload: { label: "Tromsø" }
      });
      expect(location.statusCode).toBe(200);

      const updatedLocation = await app.inject({
        method: "PUT",
        url: `/api/graduate-program-settings/locations/${location.json().id}`,
        payload: { label: "Tromsø (oppdatert)" }
      });
      expect(updatedLocation.statusCode).toBe(200);
      expect(updatedLocation.json().label).toBe("Tromsø (oppdatert)");

      const requirementType = await app.inject({
        method: "POST",
        url: "/api/graduate-program-settings/requirement-types",
        payload: { label: "Portefølje", description: "GitHub-lenke" }
      });
      expect(requirementType.statusCode).toBe(200);

      const deletedRequirement = await app.inject({
        method: "DELETE",
        url: `/api/graduate-program-settings/requirement-types/${requirementType.json().id}`
      });
      expect(deletedRequirement.statusCode).toBe(204);

      const deletedLocation = await app.inject({
        method: "DELETE",
        url: `/api/graduate-program-settings/locations/${location.json().id}`
      });
      expect(deletedLocation.statusCode).toBe(204);

      await app.close();
    });

    it("blocks deleting graduate program location in use", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const locationId = settings.locations[0].id;
      await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "Yara",
          title: "Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [locationId],
          trackTags: [],
          requirements: []
        }
      });

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/graduate-program-settings/locations/${locationId}`
      });
      expect(deleted.statusCode).toBe(409);
      await app.close();
    });

    it("blocks deleting graduate program requirement type in use", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const requirementTypeId = settings.requirementTypes[0].id;
      await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "Orkla",
          title: "Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: [{ requirementTypeId, isRequired: true, isDone: false, notes: "" }]
        }
      });

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/graduate-program-settings/requirement-types/${requirementTypeId}`
      });
      expect(deleted.statusCode).toBe(409);
      await app.close();
    });

    it("fills default requirements when create payload has empty requirements", async () => {
      const app = await createTestApp();
      const settings = await loadGraduateSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/graduate-programs",
        payload: {
          companyName: "Telenor",
          title: "Graduate",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().requirements.length).toBe(settings.requirementTypes.length);
      await app.close();
    });
  });

  describe("internship listings", () => {
    async function loadInternshipSettings(app: Awaited<ReturnType<typeof createTestApp>>) {
      const settings = await app.inject({ method: "GET", url: "/api/internship-settings" });
      expect(settings.statusCode).toBe(200);
      return settings.json() as {
        statuses: Array<{ id: string }>;
        locations: Array<{ id: string }>;
        requirementTypes: Array<{ id: string }>;
      };
    }

    it("rejects create with invalid statusId", async () => {
      const app = await createTestApp();
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Test AS",
          title: "Intern",
          statusId: "missing-status",
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(422);
      expect(created.json().message).toBe("Ugyldig status.");
      await app.close();
    });

    it("rejects create with invalid companyId", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyId: "missing-company",
          companyName: "Test AS",
          title: "Intern",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(422);
      expect(created.json().message).toBe("Ugyldig bedrift.");
      await app.close();
    });

    it("rejects create with empty required fields", async () => {
      const app = await createTestApp();
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: { companyName: "", title: "", statusId: "", locationIds: [], trackTags: [], requirements: [] }
      });
      expect(created.statusCode).toBe(400);
      await app.close();
    });

    it("updates an internship", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Statkraft",
          title: "Summer Intern",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(200);

      const updated = await app.inject({
        method: "PUT",
        url: `/api/internships/${created.json().id}`,
        payload: {
          companyName: "Statkraft",
          title: "Summer Intern (oppdatert)",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"],
          requirements: []
        }
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().title).toBe("Summer Intern (oppdatert)");
      await app.close();
    });

    it("returns 404 when updating unknown internship", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const updated = await app.inject({
        method: "PUT",
        url: "/api/internships/missing-id",
        payload: {
          companyName: "Statkraft",
          title: "Ghost",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(updated.statusCode).toBe(404);
      await app.close();
    });

    it("filters internships by status, location, track and search", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Equinor",
          title: "Energy Intern",
          statusId: settings.statuses[0].id,
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"],
          requirements: []
        }
      });
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "NBIM",
          title: "Investment Intern",
          statusId: settings.statuses[1]?.id ?? settings.statuses[0].id,
          locationIds: settings.locations[1] ? [settings.locations[1].id] : [],
          trackTags: ["INVESTMENT_TECH"],
          requirements: []
        }
      });

      const bySearch = await app.inject({ method: "GET", url: "/api/internships?q=Equinor" });
      expect(bySearch.json()).toHaveLength(1);

      const byStatus = await app.inject({
        method: "GET",
        url: `/api/internships?statusId=${settings.statuses[0].id}`
      });
      expect(byStatus.json().every((item: { statusId: string }) => item.statusId === settings.statuses[0].id)).toBe(true);

      const byTrack = await app.inject({ method: "GET", url: "/api/internships?track=INVESTMENT_TECH" });
      expect(byTrack.json()).toHaveLength(1);

      await app.close();
    });

    it("manages internship settings catalog", async () => {
      const app = await createTestApp();
      const location = await app.inject({
        method: "POST",
        url: "/api/internship-settings/locations",
        payload: { label: "Kristiansand" }
      });
      expect(location.statusCode).toBe(200);

      const updatedLocation = await app.inject({
        method: "PUT",
        url: `/api/internship-settings/locations/${location.json().id}`,
        payload: { label: "Kristiansand (oppdatert)" }
      });
      expect(updatedLocation.statusCode).toBe(200);

      const requirementType = await app.inject({
        method: "POST",
        url: "/api/internship-settings/requirement-types",
        payload: { label: "Motivasjonsbrev", description: "Kort tekst" }
      });
      expect(requirementType.statusCode).toBe(200);

      const deletedRequirement = await app.inject({
        method: "DELETE",
        url: `/api/internship-settings/requirement-types/${requirementType.json().id}`
      });
      expect(deletedRequirement.statusCode).toBe(204);

      const deletedLocation = await app.inject({
        method: "DELETE",
        url: `/api/internship-settings/locations/${location.json().id}`
      });
      expect(deletedLocation.statusCode).toBe(204);

      await app.close();
    });

    it("blocks deleting internship location in use", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const locationId = settings.locations[0].id;
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Yara",
          title: "Intern",
          statusId: settings.statuses[0].id,
          locationIds: [locationId],
          trackTags: [],
          requirements: []
        }
      });

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/internship-settings/locations/${locationId}`
      });
      expect(deleted.statusCode).toBe(409);
      await app.close();
    });

    it("blocks deleting internship requirement type in use", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const requirementTypeId = settings.requirementTypes[0].id;
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Orkla",
          title: "Intern",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: [{ requirementTypeId, isRequired: true, isDone: false, notes: "" }]
        }
      });

      const deleted = await app.inject({
        method: "DELETE",
        url: `/api/internship-settings/requirement-types/${requirementTypeId}`
      });
      expect(deleted.statusCode).toBe(409);
      await app.close();
    });

    it("fills default requirements when create payload has empty requirements", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: {
          companyName: "Telenor",
          title: "Intern",
          statusId: settings.statuses[0].id,
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().requirements.length).toBe(settings.requirementTypes.length);
      await app.close();
    });
  });
});
