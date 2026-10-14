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
    createKnowledge: vi.fn(),
    deleteKnowledge: vi.fn(),
    importKnowledge: vi.fn(),
    searchQuestions: vi.fn(),
    reindexQuestions: vi.fn(),
    approveCase: vi.fn(),
    rejectCase: vi.fn()
  }
}));

const api = vi.mocked(interviewPrepApi);

describe("InterviewBibelView", () => {
  beforeEach(() => {
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

    const approval = wrapper.get("button");
    const buttons = wrapper.findAll("button").filter((button) => button.text() === "Godkjenning");
    await buttons[0]?.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Market entry");
    expect(wrapper.text()).toContain("wharton.pdf");
    expect(approval).toBeTruthy();
  });
});
