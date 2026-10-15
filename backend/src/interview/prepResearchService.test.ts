import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";
import { buildReverseQuestions, PrepResearchService } from "./prepResearchService.js";
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
    await repository.insertBankQuestions(
      "u1",
      doc.id,
      Array.from({ length: 35 }, (_, i) => ({
        text: `Question number ${i + 1} about leadership?`,
        category: "behavioral" as const,
        tags: ["star"],
        origin: "rule" as const,
        contentHash: sha256Content(`q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const selectedIds = bank.slice(0, 30);

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
          selectedRefs: selectedIds.map((_, i) => `Q${i + 1}`),
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
    expect(updated?.searchSnippet.length).toBeGreaterThan(0);
    const uniqueForward = steps.filter((step, index) => index === 0 || step !== steps[index - 1]);
    expect(uniqueForward).toEqual([
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
    await repository.insertBankQuestions(
      "u1",
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: i === 0 ? "Hvorfor vil du jobbe her?" : `Q ${i}?`,
        category: (i === 0 ? "company" : "behavioral") as "company" | "behavioral",
        tags: [],
        origin: "rule" as const,
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
          selectedRefs: bank.map((_, i) => `Q${i + 1}`),
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
    await repository.insertBankQuestions(
      "u1",
      doc.id,
      Array.from({ length: 30 }, (_, i) => ({
        text: `Q ${i}?`,
        category: "behavioral" as const,
        tags: [],
        origin: "rule" as const,
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
          selectedRefs: bank.map((_, i) => `Q${i + 1}`),
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

  it("stores questions the candidate asks separately and keeps them out of the interviewer's list", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "company",
      title: "Bank",
      content: "x",
      contentHash: sha256Content("bank-reverse")
    });
    await repository.insertBankQuestions("u1", doc.id, [
      ...Array.from({ length: 30 }, (_, i) => ({
        text: `Q ${i}?`,
        category: "behavioral" as const,
        tags: [],
        origin: "rule" as const,
        contentHash: sha256Content(`reverse-q-${i}`)
      })),
      {
        text: "Hva overrasket deg mest det første året ditt her?",
        category: "personal" as const,
        audience: "ask_interviewer_personal" as const,
        tags: [],
        origin: "rule" as const,
        contentHash: sha256Content("reverse-personal")
      },
      {
        text: "Hvordan ser en typisk uke ut?",
        category: "company" as const,
        audience: "ask_interviewer_company" as const,
        tags: [],
        origin: "rule" as const,
        contentHash: sha256Content("reverse-company")
      }
    ]);
    const bank = await repository.listBankQuestions("u1");
    const candidateIds = bank.filter((q) => q.audience === "candidate").map((q) => q.id);
    const personal = bank.find((q) => q.audience === "ask_interviewer_personal")!;
    const company = bank.find((q) => q.audience === "ask_interviewer_company")!;
    const emptyReport = {
      headline: "",
      keyFacts: {},
      aboutCompany: "",
      businessAreas: [],
      strategyAndNews: [],
      cultureAndValues: [],
      roleInContext: "",
      jobAdRequirements: [],
      nicheInsights: ["Satser på KI i kundeservice"],
      companyQuestionPrep: [{ question: "Hva vet du om oss?", answerAngle: "Nevn KI-satsingen", nicheHooks: [] }],
      interviewAngles: [],
      questionsToAsk: ["Hvordan måler dere effekten av KI-satsingen?"],
      sources: []
    };
    const llmClient = new FakeLlmClient({
      structuredResults: [
        { industries: [], businessAreas: [], interviewFormats: [], caseTypes: [], values: [], themes: [], summary: "" },
        emptyReport,
        { clarifications: [{ question: "Format?" }] },
        {
          // Extra unknown refs are dropped; reverse picks use R-aliases.
          selectedRefs: [...candidateIds.map((_, i) => `Q${i + 1}`), "R1"],
          generatedQuestions: [],
          reverseQuestions: [
            { text: "Hvordan ser en typisk uke ut for en intern i KI-teamet?", audience: "ask_interviewer_company", bankRef: "R2" },
            { text: personal.text, audience: "ask_interviewer_personal", bankRef: "R1" },
            { text: "Hvordan måler dere effekten av KI-satsingen?", audience: "ask_interviewer_company", bankRef: null }
          ],
          tasks: []
        }
      ]
    });
    const research = service(llmClient, repository);
    const plan = await repository.createPrepPlan("u1", {
      companyName: "Bank",
      roleTitle: "Intern",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await research.startResearch("u1", plan.id);
    await research.submitClarificationsAndCurate("u1", plan.id, [], true);

    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
    const asked = updated!.questions.filter((q) => q.audience === "candidate");
    const toAsk = updated!.questions.filter((q) => q.audience !== "candidate");
    expect(asked).toHaveLength(30);
    expect(asked.some((q) => q.bankQuestionId === company.id)).toBe(false);
    expect(toAsk.map((q) => [q.audience, q.category, q.source])).toEqual([
      ["ask_interviewer_company", "company", "edited"],
      ["ask_interviewer_personal", "personal", "bank"],
      ["ask_interviewer_company", "company", "generated"]
    ]);
    expect(toAsk.every((q) => !q.notes)).toBe(true);

    const curationUser = llmClient.structuredCalls[3]!.options.messages[1]!.content;
    expect(curationUser).toContain(`R1 | ask_interviewer_personal | ${personal.text}`);
    expect(curationUser).toContain("Hvordan måler dere effekten av KI-satsingen?");
    const candidateBlock = curationUser.split("Spørsmål kandidaten kan stille intervjueren")[0]!;
    expect(candidateBlock).not.toContain(personal.text);
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

  it("resumes curation without re-running research LLM calls", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "Bank",
      content: "x",
      contentHash: sha256Content("resume-curate")
    });
    await repository.insertBankQuestions(
      "u1",
      doc.id,
      Array.from({ length: 35 }, (_, i) => ({
        text: `Resume Q ${i}?`,
        category: "behavioral" as const,
        tags: [],
        origin: "rule" as const,
        contentHash: sha256Content(`resume-q-${i}`)
      }))
    );
    const bank = await repository.listBankQuestions("u1");
    const plan = await repository.createPrepPlan("u1", {
      companyName: "ResumeCo",
      roleTitle: "Analyst",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repository.setPrepPlanPipeline("u1", plan.id, {
      pipelineStep: "curating_questions",
      researchNotes: "Saved notes",
      searchSnippet: "Saved search",
      companyProfileJson: JSON.stringify({
        industries: [],
        businessAreas: [],
        interviewFormats: [],
        caseTypes: [],
        values: [],
        themes: [],
        summary: "profile"
      }),
      companyReportJson: JSON.stringify({
        headline: "Rapport",
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
      })
    });
    await repository.setPrepPlanResearch("u1", plan.id, {
      researchNotes: "Saved notes",
      companyProfileJson: JSON.stringify({
        industries: [],
        businessAreas: [],
        interviewFormats: [],
        caseTypes: [],
        values: [],
        themes: [],
        summary: "profile"
      }),
      companyReportJson: JSON.stringify({
        headline: "Rapport",
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
      }),
      clarificationRound: 1,
      clarifications: [{ question: "Team?", sortOrder: 0 }]
    });
    await repository.updatePrepPlanStatus("u1", plan.id, "failed", "Kuratering feilet.");
    await repository.setPrepPlanPipeline("u1", plan.id, { pipelineStep: "curating_questions" });

    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          selectedRefs: bank.slice(0, 22).map((_, i) => `Q${i + 1}`).concat(["Q999", "bogus", "Q1"]),
          generatedQuestions: [],
          tasks: []
        }
      ]
    });
    const research = service(llmClient, repository);
    const resumed = await research.enqueueResume("u1", plan.id);
    expect(resumed.status).toBe("curating");

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await repository.getPrepPlan("u1", plan.id);
      if (current?.status === "ready" || current?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const ready = await repository.getPrepPlan("u1", plan.id);
    expect(ready?.status).toBe("ready");
    expect(ready?.questions.filter((q) => q.audience === "candidate")).toHaveLength(30);
    expect(ready?.curationFilledCount).toBe(8);
    expect(llmClient.webSearchCalls).toHaveLength(0);
    expect(llmClient.completeCalls).toHaveLength(0);
    expect(llmClient.structuredCalls).toHaveLength(1);
  });

  it("resumes company_report using stored search snippet and notes", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const plan = await repository.createPrepPlan("u1", {
      companyName: "ResumeReport",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repository.setPrepPlanPipeline("u1", plan.id, {
      pipelineStep: "company_report",
      searchSnippet: "Cached nettsøk",
      researchNotes: "Cached notes",
      companyProfileJson: JSON.stringify({
        industries: ["banking"],
        businessAreas: [],
        interviewFormats: [],
        caseTypes: [],
        values: [],
        themes: [],
        summary: "Cached profile"
      })
    });
    await repository.updatePrepPlanStatus("u1", plan.id, "failed", "Rapport feilet.");

    const llmClient = new FakeLlmClient({
      structuredResults: [
        {
          headline: "Ny rapport",
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
        { clarifications: [{ question: "Avdeling?" }] }
      ]
    });
    const research = service(llmClient, repository);
    await research.enqueueResume("u1", plan.id);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await repository.getPrepPlan("u1", plan.id);
      if (current?.status === "awaiting_answers" || current?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("awaiting_answers");
    expect(updated?.researchNotes).toBe("Cached notes");
    expect(updated?.searchSnippet).toBe("Cached nettsøk");
    expect(updated?.companyReportJson).toContain("Ny rapport");
    expect(llmClient.webSearchCalls).toHaveLength(0);
    expect(llmClient.completeCalls).toHaveLength(0);
    expect(llmClient.structuredCalls).toHaveLength(2);
    const reportUser = llmClient.structuredCalls[0]!.options.messages.find((m) => m.role === "user")!.content;
    expect(reportUser).toContain("Cached nettsøk");
    expect(reportUser).toContain("Cached notes");
  });

  it("fails curation with a clear message when the bank is too small", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await repository.createKnowledgeDoc("u1", {
      kind: "star",
      title: "Tiny",
      content: "x",
      contentHash: sha256Content("tiny-bank")
    });
    await repository.insertBankQuestions(
      "u1",
      doc.id,
      Array.from({ length: 10 }, (_, i) => ({
        text: `Tiny ${i}?`,
        category: "behavioral" as const,
        tags: [],
        origin: "rule" as const,
        contentHash: sha256Content(`tiny-${i}`)
      }))
    );
    const plan = await repository.createPrepPlan("u1", {
      companyName: "TinyCo",
      roleTitle: "X",
      format: "interview",
      researchModel: "gpt-6-astra"
    });
    await repository.setPrepPlanPipeline("u1", plan.id, {
      pipelineStep: "curating_questions",
      researchNotes: "notes",
      companyProfileJson: JSON.stringify({
        industries: [],
        businessAreas: [],
        interviewFormats: [],
        caseTypes: [],
        values: [],
        themes: [],
        summary: ""
      }),
      companyReportJson: JSON.stringify({
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
      })
    });
    await repository.setPrepPlanResearch("u1", plan.id, {
      researchNotes: "notes",
      clarificationRound: 1,
      clarifications: [{ question: "?", sortOrder: 0 }]
    });
    await repository.updatePrepPlanStatus("u1", plan.id, "failed", "x");
    await repository.setPrepPlanPipeline("u1", plan.id, { pipelineStep: "curating_questions" });

    const llmClient = new FakeLlmClient({ structuredResults: [] });
    const research = service(llmClient, repository);
    await research.enqueueResume("u1", plan.id);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await repository.getPrepPlan("u1", plan.id);
      if (current?.status === "failed" && current.failureReason?.includes("aktive spørsmål")) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const failed = await repository.getPrepPlan("u1", plan.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.failureReason).toMatch(/Spørsmålsbanken har bare 10 aktive spørsmål/);
    expect(llmClient.structuredCalls).toHaveLength(0);
  });
});

describe("buildReverseQuestions", () => {
  const bankRow = (id: string, text: string, audience: "ask_interviewer_company" | "ask_interviewer_personal") => ({
    id,
    userId: "u1",
    knowledgeDocId: "d",
    text,
    category: audience === "ask_interviewer_company" ? ("company" as const) : ("personal" as const),
    audience,
    status: "active" as const,
    origin: "rule" as const,
    sourceText: text,
    tags: [],
    contentHash: id,
    createdAt: ""
  });

  it("caps company and personal questions and drops duplicates", () => {
    const picks = [
      ...Array.from({ length: 7 }, (_, i) => ({
        text: `Om selskapet ${i}?`,
        audience: "ask_interviewer_company" as const,
        bankQuestionId: null
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        text: `Personlig ${i}?`,
        audience: "ask_interviewer_personal" as const,
        bankQuestionId: null
      })),
      { text: "Om selskapet 0?", audience: "ask_interviewer_company" as const, bankQuestionId: null }
    ];
    const out = buildReverseQuestions(picks, [], []);
    expect(out.filter((q) => q.audience === "ask_interviewer_company")).toHaveLength(5);
    expect(out.filter((q) => q.audience === "ask_interviewer_personal")).toHaveLength(3);
  });

  it("ignores unknown bank ids", () => {
    const [question] = buildReverseQuestions(
      [{ text: "Hva er neste steg?", audience: "ask_interviewer_company", bankQuestionId: "nope" }],
      [],
      []
    );
    expect(question).toMatchObject({ source: "generated", bankQuestionId: undefined, category: "company" });
  });

  it("falls back to report suggestions and personal bank questions", () => {
    const out = buildReverseQuestions(
      [],
      [
        bankRow("p1", "Hva overrasket deg?", "ask_interviewer_personal"),
        bankRow("c1", "Hva er neste steg?", "ask_interviewer_company"),
        bankRow("p2", "Hva fikk deg til å bli?", "ask_interviewer_personal"),
        bankRow("p3", "Hva gjør du nå?", "ask_interviewer_personal")
      ],
      ["Forslag 1?", "Forslag 2?", "Forslag 3?", "Forslag 4?"]
    );
    expect(out.map((q) => q.text)).toEqual([
      "Forslag 1?",
      "Forslag 2?",
      "Forslag 3?",
      "Hva overrasket deg?",
      "Hva fikk deg til å bli?"
    ]);
    expect(out[3]).toMatchObject({ source: "bank", bankQuestionId: "p1", category: "personal" });
  });
});
