import { describe, expect, it } from "vitest";
import { applicationKindFromQuery, sortApplications } from "./applicationRows.js";

describe("application rows", () => {
  it("reads only the two application kinds from the query", () => {
    expect(applicationKindFromQuery("internship")).toBe("internship");
    expect(applicationKindFromQuery("graduate")).toBe("graduate");
    expect(applicationKindFromQuery("course")).toBe("all");
    expect(applicationKindFromQuery(undefined)).toBe("all");
  });

  it("orders dated applications before undated ones, then by company", () => {
    const sorted = sortApplications([
      { companyName: "Zebra", deadline: "" },
      { companyName: "Beta", deadline: "2026-11-01" },
      { companyName: "Alpha", deadline: "2026-10-01" },
      { companyName: "Ås", deadline: undefined }
    ]);

    expect(sorted.map((item) => item.companyName)).toEqual(["Alpha", "Beta", "Zebra", "Ås"]);
  });
});
