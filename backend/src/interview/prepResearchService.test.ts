import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";
import { PrepResearchService } from "./prepResearchService.js";
import { sha256Content } from "./contentHash.js";

function service(llmClient: FakeLlmClient, repository: InterviewPrepMemoryRepository) {
  return new PrepResearchService(llmClient, repository, new JobCancellationRegistry());
}

describe("PrepResearchService", () => {
  it("runs research and bank-driven curation flow", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "STAR bank",
      content: Array.from({ length: 35 }, (_, i) => `${i + 1}. Question number ${i + 1} about leadership?`).join(
        "\n"
      ),
      contentHash: sha256Content("bank-doc")
    });
    await repository.replaceBankQuestionsForDoc(
      "u1",
      doc.id,
      Array.from({ length: 35 }, (_, i) => ({
        text: `Question number ${i + 1} about leadership?`,
        category: "behavioral" as const,
        tags: ["star"],
        contentHash: sha256Content(`q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const selectedIds = bank.slice(0, 30).map((q) => q.id);

    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: ["banking"],
          businessAreas: ["corporate"],
          interviewFormats: ["behavioral"],
          caseTypes: [],
          values: ["integrity"],
          themes: ["leadership"],
          summary: "DNB profile"
        },
        {
          headline: "DNB oversikt",
          keyFacts: { industry: "banking" },
          aboutCompany: "Norsk bank",
          businessAreas: ["corporate"],
          strategyAndNews: [],
          cultureAndValues: ["integrity"],
          roleInContext: "Consultant",
          jobAdRequirements: [],
          nicheInsights: ["Nordisk markets-franchise"],
          companyQuestionPrep: [
            {
              question: "Hvorfor DNB?",
              answerAngle: "Koble egen erfaring til DNBs nordiske franchise.",
              nicheHooks: ["Nordisk markets-franchise"]
            }
          ],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        },
        { clarifications: [{ question: "Hvilken avdeling?" }] },
        {
          selectedQuestionIds: selectedIds,
          generatedQuestions: [],
          tasks: [{ title: "Les årsrapport", description: "Noter tall." }]
        }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "DNB",
      roleTitle: "Consultant",
      format: "interview",
      researchModel: "gpt-5.5"
    });

    const steps: string[] = [];
    const original = repository.setPrepPlanPipeline.bind(repository);
    repository.setPrepPlanPipeline = async (userId, id, input) => {
      steps.push(input.pipelineStep);
      return original(userId, id, input);
    };

    await research.startResearch("u1", plan.id);
    let updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("awaiting_answers");
    expect(updated?.pipelineStep).toBe("awaiting_answers");
    expect(steps).toEqual([
      "searching",
      "research_notes",
      "company_profile",
      "company_report",
      "clarifications",
      "awaiting_answers"
    ]);
    expect(updated?.clarifications).toHaveLength(1);
    expect(updated?.companyProfileJson).toContain("banking");
    expect(updated?.companyReportJson).toContain("DNB oversikt");
    expect(llmClient.webSearchCalls[0]?.options?.model).toBe("gpt-5.5");
    expect(llmClient.completeCalls.every((call) => call.model === "gpt-5.5")).toBe(true);
    expect(llmClient.structuredCalls.every((call) => call.options.model === "gpt-5.5")).toBe(true);

    await research.submitClarificationsAndCurate("u1", plan.id, [
      { id: updated!.clarifications[0]!.id, answer: "Corporate banking" }
    ]);

    updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
    expect(updated?.questions.length).toBe(30);
    expect(updated?.questions.every((q) => q.source === "bank")).toBe(true);
    expect(updated?.tasks.length).toBeGreaterThan(0);
    expect(updated?.tasks.some((t) => /bedrift|Hvorfor DNB|nisje/i.test(`${t.title} ${t.description}`))).toBe(
      true
    );
    expect(llmClient.structuredCalls.every((call) => call.options.model === "gpt-5.5")).toBe(true);
    const curationUser = llmClient.structuredCalls
      .map((c) => c.options.messages.find((m) => m.role === "user")?.content ?? "")
      .find((content) => content.includes("Bedriftsrapport"));
    expect(curationUser).toContain("nicheInsights");
  });

  it("attaches answer notes to company questions from the report", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "Bank",
      content: "x",
      contentHash: sha256Content("bank-company-notes")
    });
    await repository.replaceBankQuestionsForDoc(
      "u1",
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: i === 0 ? "Hvorfor vil du jobbe her?" : `Q ${i}?`,
        category: (i === 0 ? "company" : "behavioral") as "company" | "behavioral",
        tags: [],
        contentHash: sha256Content(`company-note-q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: [],
          businessAreas: [],
          interviewFormats: [],
          caseTypes: [],
          values: [],
          themes: [],
          summary: ""
        },
        {
          headline: "Acme",
          keyFacts: {},
          aboutCompany: "",
          businessAreas: [],
          strategyAndNews: [],
          cultureAndValues: [],
          roleInContext: "",
          jobAdRequirements: [],
          nicheInsights: ["Produkt Y"],
          companyQuestionPrep: [
            {
              question: "Hvorfor vil du jobbe her?",
              answerAngle: "Koble til Produkt Y og egen erfaring.",
              nicheHooks: ["Produkt Y"]
            }
          ],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        },
        { clarifications: [{ question: "Team?" }] },
        {
          selectedQuestionIds: bank.map((q) => q.id),
          generatedQuestions: [],
          tasks: []
        }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "Acme",
      roleTitle: "Engineer",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await research.startResearch("u1", plan.id);
    const awaiting = await repository.getPrepPlan("u1", plan.id);
    await research.submitClarificationsAndCurate("u1", plan.id, [], true);
    const ready = await repository.getPrepPlan("u1", plan.id);
    expect(ready?.status).toBe("ready");
    const companyQ = ready?.questions.find((q) => q.category === "company");
    expect(companyQ?.notes).toMatch(/Svarforslag/);
    expect(companyQ?.notes).toMatch(/Produkt Y/);
    expect(awaiting?.companyReportJson).toContain("Produkt Y");
  });

  it("allows skipping clarification round", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "STAR bank",
      content: "x",
      contentHash: sha256Content("bank-doc-2")
    });
    await repository.replaceBankQuestionsForDoc(
      "u1",
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: `Q ${i}?`,
        category: "behavioral" as const,
        tags: [],
        contentHash: sha256Content(`skip-q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: [],
          businessAreas: [],
          interviewFormats: [],
          caseTypes: [],
          values: [],
          themes: [],
          summary: ""
        },
        {
          headline: "",
          keyFacts: {},
          aboutCompany: "",
          businessAreas: [],
          strategyAndNews: [],
          cultureAndValues: [],
          roleInContext: "",
          jobAdRequirements: [],
          nicheInsights: [],
          companyQuestionPrep: [],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        },
        { clarifications: [{ question: "Format?" }] },
        {
          selectedQuestionIds: bank.map((q) => q.id),
          generatedQuestions: [],
          tasks: []
        }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "X",
      roleTitle: "Y",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await research.startResearch("u1", plan.id);
    await research.submitClarificationsAndCurate("u1", plan.id, [], true);
    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
  });

  it("includes jobAdText in research prompts and stores the company report", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: [],
          businessAreas: [],
          interviewFormats: [],
          caseTypes: [],
          values: [],
          themes: [],
          summary: ""
        },
        {
          headline: "Rapport",
          keyFacts: { industry: "tech" },
          aboutCompany: "Om",
          businessAreas: [],
          strategyAndNews: [],
          cultureAndValues: [],
          roleInContext: "Rolle",
          jobAdRequirements: [{ requirement: "Python", howToShowFit: "Vis prosjekt" }],
          nicheInsights: ["Skyplattform X"],
          companyQuestionPrep: [
            {
              question: "Hvorfor Acme?",
              answerAngle: "Koble Python-erfaring til skyplattform X.",
              nicheHooks: ["Skyplattform X"]
            }
          ],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        },
        { clarifications: [{ question: "Team?" }] }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "Acme",
      roleTitle: "Engineer",
      format: "interview",
      researchModel: "gpt-6-astra",
      jobAdText: "Vi søker en Python-utvikler med erfaring fra sky."
    });

    await research.startResearch("u1", plan.id);
    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("awaiting_answers");
    expect(updated?.companyReportJson).toContain("Rapport");
    expect(updated?.jobAdText).toContain("Python-utvikler");

    const notesPrompt = llmClient.completeCalls[0]?.messages.find((m) => m.role === "user")?.content ?? "";
    expect(notesPrompt).toContain("Stillingsannonse");
    expect(notesPrompt).toContain("Python-utvikler");

    const reportCall = llmClient.structuredCalls.find((call) =>
      call.options.messages.some(
        (m) => m.role === "system" && m.content.includes("bedriftsrapport")
      )
    );
    expect(reportCall).toBeTruthy();
    const reportUser = reportCall?.options.messages.find((m) => m.role === "user")?.content ?? "";
    expect(reportUser).toContain("Python-utvikler");
  });

  it("marks plan failed when company report schema validation fails", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          industries: [],
          businessAreas: [],
          interviewFormats: [],
          caseTypes: [],
          values: [],
          themes: [],
          summary: ""
        },
        {
          headline: "x".repeat(200),
          keyFacts: {},
          aboutCompany: "",
          businessAreas: [],
          strategyAndNews: [],
          cultureAndValues: [],
          roleInContext: "",
          jobAdRequirements: [],
          nicheInsights: [],
          companyQuestionPrep: [],
          interviewAngles: [],
          questionsToAsk: [],
          sources: []
        }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "Bad",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });

    await expect(research.startResearch("u1", plan.id)).rejects.toThrow();
    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("failed");
  });
});
