import type { InterviewBankQuestionDto, InterviewImportJobDto } from "@careercenter/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import QuestionBankPanel from "./QuestionBankPanel.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    searchQuestions: vi.fn(),
    questionSummary: vi.fn(),
    updateQuestion: vi.fn(),
    discardQuestion: vi.fn(),
    restoreQuestion: vi.fn(),
    cleanupQuestions: vi.fn(),
    reindexQuestions: vi.fn()
  }
}));

const api = vi.mocked(interviewPrepApi);

function question(overrides: Partial<InterviewBankQuestionDto> = {}): InterviewBankQuestionDto {
  return {
    id: "q1",
    knowledgeDocId: "doc-1",
    text: "Hvordan håndterer du uenighet?",
    category: "behavioral",
    audience: "candidate",
    status: "active",
    origin: "rule",
    sourceText: "Hvordan håndterer du uenighet?",
    tags: [],
    contentHash: "h",
    cleanedAt: "2026-10-15T00:00:00.000Z",
    createdAt: "",
    ...overrides
  };
}

const docs = [
  {
    id: "doc-1",
    kind: "company" as const,
    title: "Bedrift",
    content: "",
    sourceFilename: "bedrift.docx",
    contentHash: "d",
    createdAt: "",
    updatedAt: ""
  }
];

function cleanupJob(status: InterviewImportJobDto["status"]): InterviewImportJobDto {
  return {
    id: "job-1",
    knowledgeDocId: "doc-1",
    kind: "questions_cleanup",
    status,
    progress: 50,
    message: "Rydder spørsmål: 1 av 2.",
    createdAt: "",
    updatedAt: ""
  };
}

/** Segment buttons carry a count, so they match on the start of the label; row buttons match exactly. */
function findButton(wrapper: ReturnType<typeof mount>, text: string, exact = true) {
  const button = wrapper
    .findAll("button")
    .find((item) => (exact ? item.text() === text : item.text().startsWith(text)));
  if (!button) throw new Error(`Fant ikke knappen ${text}`);
  return button;
}

describe("QuestionBankPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.searchQuestions.mockResolvedValue([question()]);
    api.questionSummary.mockResolvedValue({
      byAudience: { candidate: 1, ask_interviewer_personal: 2, ask_interviewer_company: 3 },
      discarded: 4,
      uncleaned: 5
    });
  });

  it("shows segments with counts and loads questions for the chosen audience", async () => {
    const wrapper = mount(QuestionBankPanel, { props: { docs, jobs: [], aiConfigured: true } });
    await flushPromises();

    expect(wrapper.text()).toContain("Spørsmål til meg (1)");
    expect(wrapper.text()).toContain("Forkastet (4)");
    expect(wrapper.text()).toContain("5 spørsmål venter på KI-opprydding.");
    expect(wrapper.text()).toMatch(/Atferd \(STAR\) ·\s+bedrift\.docx/);
    expect(api.searchQuestions).toHaveBeenLastCalledWith({ q: undefined, audience: "candidate", category: undefined });

    await findButton(wrapper, "Jeg spør: personlig", false).trigger("click");
    await flushPromises();
    expect(api.searchQuestions).toHaveBeenLastCalledWith({
      q: undefined,
      audience: "ask_interviewer_personal",
      category: undefined
    });

    await findButton(wrapper, "Forkastet", false).trigger("click");
    await flushPromises();
    expect(api.searchQuestions).toHaveBeenLastCalledWith({ q: undefined, status: "discarded" });
  });

  it("filters by category and shows the original text of rewritten questions", async () => {
    api.searchQuestions.mockResolvedValue([
      question({ text: "Hva har gjort at du har blitt værende?", sourceText: "Spørsmålet stiller du slik: «Hva har …" })
    ]);
    const wrapper = mount(QuestionBankPanel, { props: { docs, jobs: [], aiConfigured: true } });
    await flushPromises();

    expect(wrapper.text()).toContain("Opprinnelig tekst");
    await findButton(wrapper, "Situasjon").trigger("click");
    await flushPromises();
    expect(api.searchQuestions).toHaveBeenLastCalledWith({ q: undefined, audience: "candidate", category: "situational" });
  });

  it("discards, restores and moves questions", async () => {
    api.discardQuestion.mockResolvedValue(question({ status: "discarded" }));
    api.updateQuestion.mockResolvedValue(question({ audience: "ask_interviewer_company", category: "company" }));
    const wrapper = mount(QuestionBankPanel, { props: { docs, jobs: [], aiConfigured: true } });
    await flushPromises();

    await findButton(wrapper, "Forkast").trigger("click");
    await flushPromises();
    expect(api.discardQuestion).toHaveBeenCalledWith("q1");

    await findButton(wrapper, "Rediger").trigger("click");
    await wrapper.find("select").setValue("ask_interviewer_company");
    await findButton(wrapper, "Lagre").trigger("click");
    await flushPromises();
    expect(api.updateQuestion).toHaveBeenCalledWith("q1", {
      text: undefined,
      audience: "ask_interviewer_company",
      category: "behavioral"
    });

    api.searchQuestions.mockResolvedValue([question({ status: "discarded", discardReason: "instruks_til_intervjuer" })]);
    await findButton(wrapper, "Forkastet", false).trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Instruks til intervjuer");
    await findButton(wrapper, "Gjenopprett").trigger("click");
    expect(api.restoreQuestion).toHaveBeenCalledWith("q1");
  });

  it("starts the cleanup agent and disables it without AI", async () => {
    api.cleanupQuestions.mockResolvedValue({ queuedJobs: [], uncleaned: 5, message: "5 spørsmål i 1 dokumenter ryddes" });
    const wrapper = mount(QuestionBankPanel, { props: { docs, jobs: [], aiConfigured: true } });
    await flushPromises();

    await findButton(wrapper, "Rydd spørsmål med KI").trigger("click");
    await flushPromises();
    expect(api.cleanupQuestions).toHaveBeenCalledWith(false);
    expect(wrapper.emitted("jobs-changed")).toHaveLength(1);
    expect(wrapper.text()).toContain("5 spørsmål i 1 dokumenter ryddes");

    const offline = mount(QuestionBankPanel, { props: { docs, jobs: [], aiConfigured: false } });
    await flushPromises();
    expect(findButton(offline, "Rydd spørsmål med KI").attributes("disabled")).toBeDefined();
    expect(offline.text()).toContain("KI er ikke konfigurert");
  });

  it("shows cleanup progress and reloads when the agent is done", async () => {
    const wrapper = mount(QuestionBankPanel, { props: { docs, jobs: [cleanupJob("running")], aiConfigured: true } });
    await flushPromises();
    expect(wrapper.text()).toContain("Rydder: bedrift.docx · 50%");
    const calls = api.searchQuestions.mock.calls.length;

    await wrapper.setProps({ jobs: [cleanupJob("done")] });
    await flushPromises();
    expect(api.searchQuestions.mock.calls.length).toBe(calls + 1);
  });
});
