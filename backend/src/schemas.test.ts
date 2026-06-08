import { describe, expect, it } from "vitest";
import { courseSchema, internshipSchema } from "./schemas.js";

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
        statusId: "status-1"
      })
    ).toThrow();
  });
});
