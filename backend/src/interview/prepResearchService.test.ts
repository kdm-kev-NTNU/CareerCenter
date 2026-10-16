import { describe, expect, it } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { JobCancellationRegistry } from "./jobCancellationRegistry.js";
import { PrepResearchService } from "./prepResearchService.js";
import { sha256Content } from "./contentHash.js";

function service(llmClient: FakeLlmClient, repository: InterviewPrepMemoryRepository) {
  return new PrepResearchService(llmClient, repository, new JobCancellationRegistry(), { error: () => {} });
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
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
          sources: []
        },
        { clarifications: [{ question: "Hvilken avdeling?" }] },
        {
          selectedRefs: selectedIds.map((_, i) => `Q${i + 1}`),
          generatedQuestions: []
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
    // Reasoning web search measured ~110s; the 60s client default must never apply to research steps.
    expect(llmClient.webSearchCalls[0]?.options?.timeoutMs).toBeGreaterThanOrEqual(240_000);
    expect(llmClient.completeCalls.every((call) => (call.timeoutMs ?? 0) > 60_000)).toBe(true);
    expect(llmClient.structuredCalls.every((call) => (call.options.timeoutMs ?? 0) > 60_000)).toBe(true);

    await research.submitClarificationsAndCurate("u1", plan.id, [
      { id: updated!.clarifications[0]!.id, answer: "Corporate banking" }
    ]);

    updated = await repository.getPrepPlan("u1", plan.id);
    expect(updated?.status).toBe("ready");
    expect(updated?.questions.length).toBe(30);
    expect(updated?.questions.every((q) => q.source === "bank")).toBe(true);
    expect(updated?.questions.every((q) => q.audience === "candidate")).toBe(true);
    expect(llmClient.structuredCalls.every((call) => call.options.model === "gpt-5.5")).toBe(true);
    const curationUser = llmClient.structuredCalls
      .map((c) => c.options.messages.find((m) => m.role === "user")?.content ?? "")
      .find((content) => content.includes("Bedriftsrapport"));
    expect(curationUser).toContain("mustKnow");
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
          sources: []
        },
        { clarifications: [{ question: "Team?" }] },
        {
          selectedRefs: bank.map((_, i) => `Q${i + 1}`),
          generatedQuestions: []
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
    expect(awaiting?.companyReportJson).toContain("mustKnow");
    expect(awaiting?.companyReportJson).toContain("questionPrep");
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
          sources: []
        },
        { clarifications: [{ question: "Format?" }] },
        {
          selectedRefs: bank.map((_, i) => `Q${i + 1}`),
          generatedQuestions: []
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

  it("keeps reverse-bank questions out of the curated plan (they live on the report)", async () => {
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
      }
    ]);
    const bank = await repository.listBankQuestions("u1");
    const candidateIds = bank.filter((q) => q.audience === "candidate").map((q) => q.id);
    const personal = bank.find((q) => q.audience === "ask_interviewer_personal")!;
    const report = {
      headline: "DNB oversikt",
      mustKnow: ["Nordisk markets-franchise"],
      questionPrep: [
        { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
        { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
        { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
        { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
        { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
        { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
      ],
      questionsToAsk: [
        { question: "Hvordan måles suksess?", why: "Forventninger" },
        { question: "Hvordan ser en uke ut?", why: "Praktisk" },
        { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
        { question: "Hva liker du best?", why: "Personlig" }
      ],
      sources: []
    };
    const llmClient = new FakeLlmClient({
      structuredResults: [
        { industries: [], businessAreas: [], interviewFormats: [], caseTypes: [], values: [], themes: [], summary: "" },
        report,
        { clarifications: [{ question: "Format?" }] },
        {
          selectedRefs: candidateIds.map((_, i) => `Q${i + 1}`),
          generatedQuestions: []
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
    expect(updated!.questions.every((q) => q.audience === "candidate")).toBe(true);
    expect(updated!.questions).toHaveLength(30);
    expect(updated!.questions.some((q) => q.bankQuestionId === personal.id)).toBe(false);
    expect(updated?.companyReportJson).toContain("Hvordan måles suksess?");

    const reportUser = llmClient.structuredCalls
      .map((c) => c.options.messages.find((m) => m.role === "user")?.content ?? "")
      .find((content) => content.includes("Kandidatbakgrunn"));
    expect(reportUser).toContain(personal.text);

    const curationUser = llmClient.structuredCalls[3]!.options.messages[1]!.content;
    expect(curationUser).not.toContain("Spørsmål kandidaten kan stille");
    expect(curationUser).not.toContain(personal.text);
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
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
    expect(updated?.companyReportJson).toContain("DNB oversikt");
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
          mustKnow: [],
          questionPrep: [],
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
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
          generatedQuestions: []
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
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
    expect(updated?.companyReportJson).toContain("DNB oversikt");
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
          headline: "DNB oversikt",
          mustKnow: ["Nordisk markets-franchise"],
          questionPrep: [
            { question: "Fortell om deg selv", whyTheyAsk: "Struktur", suggestedAnswer: "Jeg ...", backgroundUsed: ["NTNU"], companyHooks: [] },
            { question: "Hvorfor oss?", whyTheyAsk: "Research", suggestedAnswer: "Fordi ...", backgroundUsed: ["SpareBank"], companyHooks: ["Nordisk markets"] },
            { question: "Hvorfor denne rollen?", whyTheyAsk: "Motivasjon", suggestedAnswer: "Rollen ...", backgroundUsed: ["RAG"], companyHooks: [] },
            { question: "Hvorfor er du egnet?", whyTheyAsk: "Fit", suggestedAnswer: "Jeg tilfører ...", backgroundUsed: ["Cogito"], companyHooks: [] },
            { question: "Hva vet du om oss?", whyTheyAsk: "Research", suggestedAnswer: "Dere ...", backgroundUsed: [], companyHooks: ["markets"] },
            { question: "Hvordan jobber du i team?", whyTheyAsk: "Samarbeid", suggestedAnswer: "I team ...", backgroundUsed: ["tverrfaglig"], companyHooks: [] }
          ],
          questionsToAsk: [
            { question: "Hvordan måles suksess?", why: "Forventninger" },
            { question: "Hvordan ser en uke ut?", why: "Praktisk" },
            { question: "Hvilke prosjekter er aktuelle?", why: "Fit" },
            { question: "Hva liker du best?", why: "Personlig" }
          ],
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

