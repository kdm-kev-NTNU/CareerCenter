import { describe, expect, it, vi } from "vitest";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import {
  buildVideoQuestionsPrompt,
  generateVideoQuestions
} from "./videoQuestions.js";

describe("buildVideoQuestionsPrompt", () => {
  it("includes company, role and count", () => {
    const prompt = buildVideoQuestionsPrompt({
      companyName: "McKinsey",
      roleDescription: "Business Analyst i Oslo",
      count: 3
    });
    expect(prompt.user).toContain("Bedrift: McKinsey");
    expect(prompt.user).toContain("Business Analyst i Oslo");
    expect(prompt.user).toContain("Antall spørsmål: 3");
    expect(prompt.system).toMatch(/norsk/i);
  });
});

describe("generateVideoQuestions", () => {
  it("returns exactly count questions", async () => {
    const llm = new FakeLlmClient({
      structuredResult: {
        questions: ["Spørsmål 1?", "Spørsmål 2?", "Spørsmål 3?"]
      }
    });
    const result = await generateVideoQuestions(llm, {
      companyName: "BCG",
      roleDescription: "Associate",
      count: 3
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(3);
    expect(llm.structuredCalls).toHaveLength(1);
    const user = llm.structuredCalls[0]?.options.messages.find((m) => m.role === "user")?.content;
    expect(user).toContain("BCG");
    expect(user).toContain("Associate");
  });

  it("retries when questions are not distinct then fails", async () => {
    const llm = new FakeLlmClient({
      structuredResults: [
        { questions: ["Samme?", "Samme?"] },
        { questions: ["Samme?", "Samme?"] }
      ]
    });
    const log = { warn: vi.fn() };
    const result = await generateVideoQuestions(
      llm,
      { companyName: "Firm", roleDescription: "", count: 2 },
      { log }
    );
    expect(result.ok).toBe(false);
    expect(llm.structuredCalls).toHaveLength(2);
    expect(log.warn).toHaveBeenCalled();
  });

  it("retries after wrong count then succeeds", async () => {
    const llm = new FakeLlmClient({
      structuredResults: [
        { questions: ["Bare ett?"] },
        { questions: ["Ett?", "To?"] }
      ]
    });
    const result = await generateVideoQuestions(llm, {
      companyName: "Firm",
      roleDescription: "",
      count: 2
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toEqual(["Ett?", "To?"]);
    expect(llm.structuredCalls).toHaveLength(2);
  });

  it("respects abort without retry", async () => {
    const abortError = Object.assign(new Error("Avbrutt"), { name: "AbortError" });
    const llm = new FakeLlmClient({
      structuredErrors: [abortError]
    });
    const result = await generateVideoQuestions(llm, {
      companyName: "Firm",
      roleDescription: "",
      count: 2
    });
    expect(result.ok).toBe(false);
    expect(llm.structuredCalls).toHaveLength(1);
  });

  it("forwards model override", async () => {
    const llm = new FakeLlmClient({
      structuredResult: { questions: ["A?", "B?"] }
    });
    await generateVideoQuestions(
      llm,
      { companyName: "Firm", roleDescription: "", count: 2 },
      { model: "gpt-6-luna" }
    );
    expect(llm.structuredCalls[0]?.options.model).toBe("gpt-6-luna");
  });
});
