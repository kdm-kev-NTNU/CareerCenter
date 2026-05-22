import { afterEach, describe, expect, it, vi } from "vitest";
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
});
