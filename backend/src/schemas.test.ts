import { describe, expect, it } from "vitest";
import { courseSchema, internshipSchema, thesisCompanySchema } from "./schemas.js";

describe("schemas", () => {
  it("parses valid course payloads", () => {
    const parsed = courseSchema.parse({
      semester: 7,
      courseCode: "TDT4173",
      title: "ML",
      credits: 7.5,
      status: "planned",
      notes: "",
      trackTags: ["ENERGY_QUANT"],
      sortOrder: 0
    });
    expect(parsed.courseCode).toBe("TDT4173");
  });

  it("rejects internship payloads without company name", () => {
    expect(() =>
      internshipSchema.parse({
        companyName: "",
        title: "Intern",
        statusId: "status-1",
        stageIds: ["status-1"]
      })
    ).toThrow();
  });

  it("rejects internship payloads without a pipeline", () => {
    expect(() =>
      internshipSchema.parse({
        companyName: "Statkraft",
        title: "Intern",
        statusId: "status-1",
        stageIds: []
      })
    ).toThrow();
  });

  it("parses valid thesis company payloads", () => {
    const parsed = thesisCompanySchema.parse({
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
    });
    expect(parsed.companyName).toBe("SINTEF");
    expect(parsed.targetSemester).toBe(10);
  });

  it("rejects thesis company payloads without company name", () => {
    expect(() =>
      thesisCompanySchema.parse({
        companyName: ""
      })
    ).toThrow();
  });
});
