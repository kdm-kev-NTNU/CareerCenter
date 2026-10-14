import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  request: vi.fn(),
  uploadRequest: vi.fn()
}));

import { request, uploadRequest } from "./client.js";
import { interviewPrepApi } from "./interviewPrep.js";

const mockedRequest = vi.mocked(request);
const mockedUpload = vi.mocked(uploadRequest);

describe("interviewPrepApi", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedUpload.mockReset();
    mockedRequest.mockResolvedValue({});
    mockedUpload.mockResolvedValue({});
  });

  it("calls status and knowledge endpoints", async () => {
    await interviewPrepApi.getStatus();
    await interviewPrepApi.knowledgeDocs();
    await interviewPrepApi.createKnowledge({ title: "t", content: "c", kind: "star" });
    await interviewPrepApi.updateKnowledge("d1", { title: "t2", content: "c2" });
    await interviewPrepApi.deleteKnowledge("d1");

    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/status");
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/knowledge");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/knowledge",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/knowledge/d1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/knowledge/d1", { method: "DELETE" });
  });

  it("imports knowledge via uploadRequest", async () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    await interviewPrepApi.importKnowledge(file);
    expect(mockedUpload).toHaveBeenCalledWith("/api/interview/knowledge/import", expect.any(FormData));
  });

  it("builds question search query params", async () => {
    await interviewPrepApi.searchQuestions({ q: "ledelse", category: "behavioral", tag: "star" });
    await interviewPrepApi.reindexQuestions();
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/questions?q=ledelse&category=behavioral&tag=star"
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/reindex", { method: "POST" });
  });

  it("lists and manages cases", async () => {
    await interviewPrepApi.cases({ q: "profit", sourceKind: "casebook", approvalStatus: "pending" });
    await interviewPrepApi.approveCase("c1");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/cases?q=profit&sourceKind=casebook&approvalStatus=pending"
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/cases/c1/approve", { method: "POST" });
  });

  it("covers prep plan and voice helpers", async () => {
    await interviewPrepApi.createPlan({ companyName: "DNB", roleTitle: "Analyst", format: "interview" });
    await interviewPrepApi.plan("p1");
    await interviewPrepApi.submitClarifications("p1", [], true);
    await interviewPrepApi.replacePlanQuestion("p1", "q1", { text: "Alt?" });
    await interviewPrepApi.createVoiceSession();
    await interviewPrepApi.transcribeVideo({ transcript: "hi" } as never);

    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/plans/p1");
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans/p1/clarifications",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans/p1/questions/q1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/voice/session", { method: "POST" });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/video/transcribe",
      expect.objectContaining({ method: "POST" })
    );
  });
});
