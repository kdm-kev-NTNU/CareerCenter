import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./memoryRepository.js";
import { buildServer } from "./server.js";

async function createTestApp() {
  const app = await buildServer({ repository: new MemoryRepository(), authDisabled: true });
  await app.ready();
  return app;
}

function internshipStageIds(settings: { statuses: Array<{ id: string; kind?: string }> }) {
  return settings.statuses.filter((status) => status.kind !== "outcome").map((status) => status.id);
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

  it("allows same-origin camera and microphone", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.headers["permissions-policy"]).toBe("camera=(self), microphone=(self)");
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

  it("creates, lists, updates and deletes thesis companies", async () => {
    const app = await createTestApp();

    const created = await app.inject({
      method: "POST",
      url: "/api/thesis-companies",
      payload: {
        companyName: "SINTEF",
        topicArea: "Energi",
        status: "known",
        source: "university",
        location: "Trondheim",
        contactPerson: "Kari",
        websiteUrl: "https://sintef.no",
        targetSemester: 10,
        trackTags: ["ENERGY_QUANT"],
        notes: "Via veileder",
        sortOrder: 0
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().companyName).toBe("SINTEF");

    const createdBody = created.json() as {
      id: string;
      companyName: string;
      topicArea: string;
      status: string;
      source: string;
      location: string;
      contactPerson: string;
      websiteUrl: string | null;
      targetSemester: number;
      trackTags: string[];
      notes: string;
      sortOrder: number;
    };

    const list = await app.inject({ method: "GET", url: "/api/thesis-companies" });
    expect(list.json()).toHaveLength(1);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/thesis-companies/${createdBody.id}`,
      payload: { ...createdBody, companyName: "SINTEF Digital" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().companyName).toBe("SINTEF Digital");

    const missing = await app.inject({
      method: "PUT",
      url: "/api/thesis-companies/missing",
      payload: createdBody
    });
    expect(missing.statusCode).toBe(404);

    const deleted = await app.inject({ method: "DELETE", url: `/api/thesis-companies/${createdBody.id}` });
    expect(deleted.statusCode).toBe(204);

    const afterDelete = await app.inject({ method: "GET", url: "/api/thesis-companies" });
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
        stageIds: internshipStageIds(settings.json()),
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
        stageIds: internshipStageIds(settings.json()),
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

  it("returns 404 when bachelor file metadata exists but bytes are missing on disk", async () => {
    const { deleteStoredFile } = await import("./bachelorFileStorage.js");
    const repository = new MemoryRepository();
    const app = await buildServer({ repository, authDisabled: true });
    await app.ready();
    const boundary = "----CareerCenterBoundary";

    const upload = await app.inject({
      method: "POST",
      url: "/api/education/bachelor/files",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload:
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="gone.txt"\r\n` +
        `Content-Type: text/plain\r\n\r\n` +
        `will disappear\r\n` +
        `--${boundary}--\r\n`
    });
    expect(upload.statusCode).toBe(201);
    const fileId = upload.json().id as string;

    const me = await app.inject({ method: "GET", url: "/api/auth/me" });
    const userId = me.json().id as string;
    const record = await repository.getBachelorFileWithStorage(userId, fileId);
    expect(record).not.toBeNull();
    await deleteStoredFile(record!.storagePath);

    const download = await app.inject({
      method: "GET",
      url: `/api/education/bachelor/files/${fileId}/download`
    });
    expect(download.statusCode).toBe(404);
    expect(download.json().message).toBe("Filen er ikke tilgjengelig.");

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

    const invalidCourse = await app.inject({
      method: "POST",
      url: "/api/courses",
      payload: { semester: 7, courseCode: "", title: "", credits: -1, status: "planned", notes: "", trackTags: [], sortOrder: 0 }
    });
    expect(invalidCourse.statusCode).toBe(400);
    expect(invalidCourse.json().message).toBe("Ugyldig forespørsel.");
    expect(invalidCourse.json().issues).toBeDefined();

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

    const importedAgents = imported.json().created.find((resource: { installPath: string }) => resource.installPath === "AGENTS.md");
    const movedAgents = await app.inject({
      method: "PUT",
      url: `/api/education/ai-resources/${importedAgents.id}`,
      payload: {
        ...importedAgents,
        folderPath: "Accessibility/WCAG",
        isStarred: true
      }
    });
    expect(movedAgents.statusCode).toBe(200);
    expect(movedAgents.json().folderPath).toBe("Accessibility/WCAG");
    expect(movedAgents.json().isStarred).toBe(true);

    const reimported = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources/import",
      payload: { files: [{ fileName: "AGENTS.md", content: "# Codex instructions\nUpdated." }] }
    });
    expect(reimported.statusCode).toBe(200);
    expect(reimported.json().updated).toHaveLength(1);
    expect(reimported.json().updated[0].folderPath).toBe("Accessibility/WCAG");
    expect(reimported.json().updated[0].isStarred).toBe(true);

    const starredList = await app.inject({ method: "GET", url: "/api/education/ai-resources?starred=true" });
    expect(starredList.json().map((resource: { id: string }) => resource.id)).toContain(importedAgents.id);

    const folderList = await app.inject({ method: "GET", url: "/api/education/ai-resources?folderPath=Accessibility%2FWCAG" });
    expect(folderList.json().map((resource: { id: string }) => resource.id)).toContain(importedAgents.id);

    const used = await app.inject({ method: "POST", url: `/api/education/ai-resources/${importedAgents.id}/used` });
    expect(used.statusCode).toBe(200);
    expect(used.json().usageCount).toBe(1);
    expect(used.json().lastUsedAt).toBeTruthy();

    const frequentList = await app.inject({ method: "GET", url: "/api/education/ai-resources?frequent=true" });
    expect(frequentList.json()[0].id).toBe(importedAgents.id);

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

  it("applies AI resource sync to an existing project directory", async () => {
    const app = await createTestApp();
    const cwd = await mkdtemp(path.join(os.tmpdir(), "careercenter-ai-sync-api-"));

    try {
      const imported = await app.inject({
        method: "POST",
        url: "/api/education/ai-resources/import",
        payload: {
          files: [{
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
          }]
        }
      });
      expect(imported.statusCode).toBe(200);

      const synced = await app.inject({
        method: "POST",
        url: "/api/education/ai-resources/sync",
        payload: { target: "cursor", cwd }
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json().dryRun).toBe(false);
      expect(synced.json().files.some((file: { path: string; action: string }) =>
        file.path === ".cursor/rules/tailwind.mdc" && file.action === "create"
      )).toBe(true);

      const ruleContent = await readFile(path.join(cwd, ".cursor/rules/tailwind.mdc"), "utf8");
      expect(ruleContent).toContain("# Tailwind");
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await app.close();
    }
  });

  it("rejects AI resource sync when project directory is missing", async () => {
    const app = await createTestApp();
    const missing = path.join(os.tmpdir(), `careercenter-missing-${Date.now()}`);

    const response = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources/sync",
      payload: { target: "all", cwd: missing }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("finnes ikke");

    await app.close();
  });

  it("rejects invalid AI resource imports and export targets", async () => {
    const app = await createTestApp();

    const rejectedImport = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources/import",
      payload: {
        files: [{
          fileName: "broken.mdc",
          content: "---\ndescription: Missing fields\n---\n# Broken"
        }]
      }
    });
    expect(rejectedImport.statusCode).toBe(200);
    expect(rejectedImport.json().rejected).toHaveLength(1);
    expect(rejectedImport.json().rejected[0].fileName).toBe("broken.mdc");

    const invalidExport = await app.inject({
      method: "GET",
      url: "/api/education/ai-resources/export?target=invalid"
    });
    expect(invalidExport.statusCode).toBe(400);
    expect(invalidExport.json().message).toBe("Ugyldig eksportmål.");

    await app.close();
  });

  it("excludes archived AI resources from export bundles", async () => {
    const app = await createTestApp();

    const active = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources",
      payload: {
        name: "Active prompt",
        kind: "prompt_snippet",
        targetTools: ["cursor"],
        status: "active",
        tags: [],
        installPath: ".cursor/snippets/active.md",
        content: "# Active",
        frontmatter: {},
        configFormat: "markdown",
        notes: ""
      }
    });
    expect(active.statusCode).toBe(200);

    const archived = await app.inject({
      method: "POST",
      url: "/api/education/ai-resources",
      payload: {
        name: "Archived prompt",
        kind: "prompt_snippet",
        targetTools: ["cursor"],
        status: "archived",
        tags: [],
        installPath: ".cursor/snippets/archived.md",
        content: "# Archived",
        frontmatter: {},
        configFormat: "markdown",
        notes: ""
      }
    });
    expect(archived.statusCode).toBe(200);

    const exportBundle = await app.inject({
      method: "GET",
      url: "/api/education/ai-resources/export?target=cursor"
    });
    expect(exportBundle.statusCode).toBe(200);
    const paths = exportBundle.json().files.map((file: { path: string }) => file.path);
    expect(paths).toContain(".cursor/snippets/active.md");
    expect(paths).not.toContain(".cursor/snippets/archived.md");

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
        statuses: Array<{ id: string; kind?: string }>;
        locations: Array<{ id: string }>;
        requirementTypes: Array<{ id: string }>;
      };
    }

    function internshipBody(
      settings: Awaited<ReturnType<typeof loadInternshipSettings>>,
      overrides: Record<string, unknown> = {}
    ) {
      return {
        companyName: "Statkraft",
        title: "Intern",
        statusId: settings.statuses[0].id,
        stageIds: internshipStageIds(settings),
        locationIds: [] as string[],
        trackTags: [] as string[],
        requirements: [] as unknown[],
        ...overrides
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
          stageIds: ["missing-status"],
          locationIds: [],
          trackTags: [],
          requirements: []
        }
      });
      expect(created.statusCode).toBe(422);
      expect(created.json().message).toBe("Ugyldig status.");
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

    it("rejects create without a pipeline", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: internshipBody(settings, { stageIds: [] })
      });
      expect(created.statusCode).toBe(400);
      await app.close();
    });

    it("stores a custom internship pipeline", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const stageIds = [settings.statuses[2].id, settings.statuses[5].id];
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: internshipBody(settings, {
          companyName: "McKinsey",
          title: "Intern",
          statusId: stageIds[0],
          stageIds
        })
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().stageIds).toEqual(stageIds);
      await app.close();
    });

    it("updates an internship", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const created = await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: internshipBody(settings, {
          companyName: "Statkraft",
          title: "Summer Intern",
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"]
        })
      });
      expect(created.statusCode).toBe(200);

      const updated = await app.inject({
        method: "PUT",
        url: `/api/internships/${created.json().id}`,
        payload: internshipBody(settings, {
          companyName: "Statkraft",
          title: "Summer Intern (oppdatert)",
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"]
        })
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
        payload: internshipBody(settings, { companyName: "Statkraft", title: "Ghost" })
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
        payload: internshipBody(settings, {
          companyName: "Equinor",
          title: "Energy Intern",
          locationIds: [settings.locations[0].id],
          trackTags: ["ENERGY_QUANT"]
        })
      });
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: internshipBody(settings, {
          companyName: "NBIM",
          title: "Investment Intern",
          statusId: settings.statuses[1]?.id ?? settings.statuses[0].id,
          locationIds: settings.locations[1] ? [settings.locations[1].id] : [],
          trackTags: ["INVESTMENT_TECH"]
        })
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

    it("reorders internship stage template", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const stageIds = internshipStageIds(settings);
      const reordered = [stageIds[1], stageIds[0], ...stageIds.slice(2)];
      const result = await app.inject({
        method: "PUT",
        url: "/api/internship-settings/statuses/reorder",
        payload: { ids: reordered }
      });
      expect(result.statusCode).toBe(200);
      expect(internshipStageIds({ statuses: result.json() })).toEqual(reordered);
      await app.close();
    });

    it("blocks deleting internship location in use", async () => {
      const app = await createTestApp();
      const settings = await loadInternshipSettings(app);
      const locationId = settings.locations[0].id;
      await app.inject({
        method: "POST",
        url: "/api/internships",
        payload: internshipBody(settings, { companyName: "Yara", locationIds: [locationId] })
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
        payload: internshipBody(settings, {
          companyName: "Orkla",
          requirements: [{ requirementTypeId, isRequired: true, isDone: false, notes: "" }]
        })
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
        payload: internshipBody(settings, { companyName: "Telenor" })
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().requirements.length).toBe(settings.requirementTypes.length);
      await app.close();
    });
  });
});
