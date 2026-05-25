import { describe, expect, it } from "vitest";
import { courseSchema, pathSchema } from "./schemas.js";

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

  it("rejects invalid path payloads", () => {
    expect(() => pathSchema.parse({ name: "" })).toThrow();
  });
});
