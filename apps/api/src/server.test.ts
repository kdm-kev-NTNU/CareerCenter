import { describe, expect, it } from "vitest";
import { MemoryRepository } from "./memoryRepository.js";
import { buildServer } from "./server.js";

async function createTestApp() {
  const app = buildServer({ repository: new MemoryRepository() });
  await app.ready();
  return app;
}

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
        name: "Energy Quant-ruten",
        description: "NTNU til global commodity trading",
        targetRole: "Quantitative Analyst",
        horizon: "5+ år",
        steps: [
          { companyId: "statkraft", order: 0, note: "Norsk start", targetRole: "Data Scientist" },
          { companyId: "incommodities", order: 1, note: "Algo trading", targetRole: "Algo Trader" },
          { companyId: "vitol", order: 2, note: "Global elite", targetRole: "Quant Analyst" }
        ]
      }
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().steps.map((step: any) => step.company.name)).toEqual(["Statkraft", "InCommodities", "Vitol"]);

    await app.close();
  });
});
