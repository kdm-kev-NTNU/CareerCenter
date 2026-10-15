import { describe, expect, it, vi } from "vitest";
import { starRubricCriteria } from "@careercenter/shared";
import { FakeLlmClient } from "../ai/fakeLlmClient.js";
import { rateStarAnswer } from "./rateStarAnswer.js";

const okScores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3]));

describe("rateStarAnswer", () => {
  it("returns feedback with computed sum on success", async () => {
    const llm = new FakeLlmClient({
      structuredResult: { scores: okScores, improvement: "Stram inn." }
    });
    const result = await rateStarAnswer(llm, "Spørsmål: X\n\nSvar: Y");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feedback.sum).toBe(24);
    expect(result.feedback.improvement).toBe("Stram inn.");
    expect(llm.structuredCalls).toHaveLength(1);
  });

  it("retries once after a transient error then succeeds", async () => {
    const llm = new FakeLlmClient({
      structuredErrors: [new Error("temporary")],
      structuredResult: { scores: okScores, improvement: "Ok." }
    });
    const log = { warn: vi.fn() };
    const result = await rateStarAnswer(llm, "Svar", { log });
    expect(result.ok).toBe(true);
    expect(llm.structuredCalls).toHaveLength(2);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("returns ok false after exhausting retries", async () => {
    const llm = new FakeLlmClient({
      structuredError: new Error("rubric down")
    });
    const result = await rateStarAnswer(llm, "Svar");
    expect(result).toEqual({ ok: false, reason: "rubric down" });
    expect(llm.structuredCalls).toHaveLength(2);
  });

  it("does not retry abort errors", async () => {
    const abortError = Object.assign(new Error("Avbrutt"), { name: "AbortError" });
    const llm = new FakeLlmClient({
      structuredErrors: [abortError]
    });
    const result = await rateStarAnswer(llm, "Svar");
    expect(result.ok).toBe(false);
    expect(llm.structuredCalls).toHaveLength(1);
  });
});
