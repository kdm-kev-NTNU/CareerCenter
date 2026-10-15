import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
  uploadRequest: vi.fn()
}));

import { request, requestBlob, uploadRequest } from "./client.js";
import { interviewPrepApi } from "./interviewPrep.js";

const mockedRequest = vi.mocked(request);
const mockedUpload = vi.mocked(uploadRequest);
const mockedRequestBlob = vi.mocked(requestBlob);

describe("interviewPrepApi", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedUpload.mockReset();
    mockedRequestBlob.mockReset();
    mockedRequest.mockResolvedValue({});
    mockedUpload.mockResolvedValue({});
    mockedRequestBlob.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
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

  it("filters questions by audience and status and manages the bank", async () => {
    await interviewPrepApi.searchQuestions({ audience: "ask_interviewer_personal", status: "discarded" });
    await interviewPrepApi.questionSummary();
    await interviewPrepApi.updateQuestion("q1", { audience: "ask_interviewer_company" });
    await interviewPrepApi.discardQuestion("q1");
    await interviewPrepApi.discardQuestion("q2", "tips");
    await interviewPrepApi.restoreQuestion("q1");
    await interviewPrepApi.cleanupQuestions(true);

    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/questions?audience=ask_interviewer_personal&status=discarded"
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/summary");
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/q1", {
      method: "PATCH",
      body: JSON.stringify({ audience: "ask_interviewer_company" })
    });
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/q1/discard", {
      method: "POST",
      body: "{}"
    });
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/q2/discard", {
      method: "POST",
      body: JSON.stringify({ reason: "tips" })
    });
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/q1/restore", { method: "POST" });
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/questions/cleanup", {
      method: "POST",
      body: JSON.stringify({ reset: true })
    });
  });

  it("drafts essentials for a mode", async () => {
    await interviewPrepApi.essentialsDraft("case_oral");
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/simulator/settings/case_oral/essentials-draft", {
      method: "POST"
    });
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
    await interviewPrepApi.createPlan({
      companyName: "DNB",
      roleTitle: "Analyst",
      format: "interview",
      researchModel: "gpt-6.1-sol",
      jobAdText: "Vi søker en analyst."
    });
    await interviewPrepApi.plan("p1");
    await interviewPrepApi.deletePlan("p1");
    await interviewPrepApi.submitClarifications("p1", [], true);
    await interviewPrepApi.replacePlanQuestion("p1", "q1", { text: "Alt?" });
    await interviewPrepApi.createVoiceSession("s1");
    await interviewPrepApi.transcribeVideo({
      file: new Blob(["audio"], { type: "audio/webm" }),
      prompt: "Fortell om en utfordring",
      withRubric: true,
      durationMs: 12_000
    });
    await interviewPrepApi.rateVideo({
      prompt: "Fortell om en utfordring",
      transcript: "Jeg løste det.",
      durationMs: 12_000
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("jobAdText")
      })
    );
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/plans/p1");
    expect(mockedRequest).toHaveBeenCalledWith("/api/interview/plans/p1", { method: "DELETE" });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans/p1/clarifications",
      expect.objectContaining({ method: "POST" })
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/plans/p1/questions/q1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/voice/session",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId: "s1" }) })
    );
    expect(mockedUpload).toHaveBeenCalledWith(
      "/api/interview/video/transcribe",
      expect.any(FormData)
    );
    const formData = mockedUpload.mock.calls.find((call) => call[0] === "/api/interview/video/transcribe")?.[1] as
      | FormData
      | undefined;
    expect(formData?.get("withRubric")).toBe("true");
    expect(formData?.get("prompt")).toBe("Fortell om en utfordring");
    expect(formData?.get("file")).toBeInstanceOf(Blob);
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/interview/video/rate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "Fortell om en utfordring",
          transcript: "Jeg løste det.",
          durationMs: 12_000
        })
      })
    );
  });

  it("downloads company report PDF via requestBlob", async () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    await interviewPrepApi.downloadCompanyReport("p1", "DNB ASA");

    expect(mockedRequestBlob).toHaveBeenCalledWith("/api/interview/plans/p1/company-report.pdf");
    expect(anchor.download).toBe("dnb-asa-bedriftsrapport.pdf");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
