import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import InterviewBibelView from "./InterviewBibelView.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    knowledgeDocs: vi.fn(),
    cases: vi.fn(),
    importJobs: vi.fn(),
    retryImportJob: vi.fn(),
    deleteImportJob: vi.fn(),
    createKnowledge: vi.fn(),
    deleteKnowledge: vi.fn(),
    importKnowledge: vi.fn(),
    getStatus: vi.fn(),
    searchQuestions: vi.fn(),
    questionSummary: vi.fn(),
    updateQuestion: vi.fn(),
    discardQuestion: vi.fn(),
    restoreQuestion: vi.fn(),
    cleanupQuestions: vi.fn(),
    reindexQuestions: vi.fn(),
    approveCase: vi.fn(),
    rejectCase: vi.fn()
  }
}));

const api = vi.mocked(interviewPrepApi);

describe("InterviewBibelView", () => {
  beforeEach(() => {
    api.getStatus.mockResolvedValue({ aiConfigured: true });
    api.knowledgeDocs.mockResolvedValue([
      {
        id: "doc-1",
        kind: "case",
        title: "Wharton",
        content: "",
        sourceFilename: "wharton.pdf",
        contentHash: "hash",
        createdAt: "",
        updatedAt: ""
      }
    ]);
    api.cases.mockImplementation(async (params) => {
      if (params?.approvalStatus === "pending") {
        return [
          {
            id: "case-1",
            title: "Market entry",
            prompt: "Gå inn i Sverige",
            sourceKind: "casebook",
            companyTags: [],
            knowledgeDocId: "doc-1",
            approvalStatus: "pending",
            createdAt: "",
            updatedAt: ""
          }
        ];
      }
      return [];
    });
    api.importJobs.mockResolvedValue([
      {
        id: "job-1",
        knowledgeDocId: "doc-1",
        kind: "cases",
        status: "running",
        progress: 40,
        message: "Chunk 2 av 5: Market entry (side 12–18). 3 gjenstår.",
        createdAt: "",
        updatedAt: ""
      }
    ]);
  });

  it("shows chunk progress and the source file for a pending case", async () => {
    const wrapper = mount(InterviewBibelView);
    await flushPromises();

    expect(wrapper.text()).toContain("wharton.pdf");
    expect(wrapper.text()).toContain("Chunk 2 av 5");
    expect(wrapper.text()).toContain("Case-import · running");

    const approval = wrapper.get("button");
    const buttons = wrapper.findAll("button").filter((button) => button.text() === "Godkjenning");
    await buttons[0]?.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Market entry");
    expect(wrapper.text()).toContain("wharton.pdf");
    expect(approval).toBeTruthy();
  });

  it("deletes stopped and finished import jobs from both lists", async () => {
    api.importJobs.mockResolvedValue([
      {
        id: "job-run",
        knowledgeDocId: "doc-1",
        kind: "cases",
        status: "running",
        progress: 40,
        message: "Segmenterer",
        createdAt: "",
        updatedAt: ""
      },
      {
        id: "job-stop",
        knowledgeDocId: "doc-1",
        kind: "cases",
        status: "cancelled",
        progress: 79,
        message: "Stoppet av bruker",
        createdAt: "",
        updatedAt: ""
      },
      {
        id: "job-done",
        knowledgeDocId: "doc-1",
        kind: "cases",
        status: "done",
        progress: 100,
        message: "1 caseutkast klare for gjennomgang",
        createdAt: "",
        updatedAt: ""
      }
    ]);
    api.deleteImportJob.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const wrapper = mount(InterviewBibelView);
    await flushPromises();

    const importList = wrapper.findAll("article").find((article) => article.text().includes("Stoppet av bruker"));
    expect(importList).toBeTruthy();
    const deleteButtons = importList!.findAll("button").filter((button) => button.text() === "Slett");
    expect(deleteButtons).toHaveLength(2);

    await deleteButtons[0]!.trigger("click");
    expect(api.deleteImportJob).toHaveBeenCalledWith("job-stop");

    const approval = wrapper.findAll("button").find((button) => button.text() === "Godkjenning");
    await approval!.trigger("click");
    await flushPromises();

    const jobsList = wrapper.findAll("article").find((article) => article.text().startsWith("Importjobber"));
    const approvalDeletes = jobsList!.findAll("button").filter((button) => button.text() === "Slett");
    expect(approvalDeletes).toHaveLength(2);
    await approvalDeletes[1]!.trigger("click");
    expect(api.deleteImportJob).toHaveBeenCalledWith("job-done");
  });
});
