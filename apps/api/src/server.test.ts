import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./memoryRepository.js";
import { buildServer } from "./server.js";

async function createTestApp() {
  const app = buildServer({ repository: new MemoryRepository() });
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

    await app.close();
  });
});
