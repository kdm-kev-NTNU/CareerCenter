import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { describePipelineFailure, PrepPipelineError } from "./pipelineErrors.js";

describe("describePipelineFailure", () => {
  it("passes through PrepPipelineError messages", () => {
    const error = new PrepPipelineError("curating_questions", "Banken er for liten.");
    expect(describePipelineFailure(error)).toBe("Banken er for liten.");
  });

  it("maps ZodError to a clear Norwegian message", () => {
    try {
      z.object({ a: z.string() }).parse({});
    } catch (error) {
      expect(describePipelineFailure(error)).toMatch(/feil format/);
    }
  });

  it("maps timeout-like errors", () => {
    const timeout = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    expect(describePipelineFailure(timeout)).toMatch(/for lang tid/);
  });

  it("maps rate limit and quota errors", () => {
    const rate = Object.assign(new Error("rate limit"), { name: "RateLimitError", status: 429 });
    expect(describePipelineFailure(rate)).toMatch(/For mange forespørsler/);
    const quota = Object.assign(new Error("insufficient_quota"), { status: 402 });
    expect(describePipelineFailure(quota)).toMatch(/kvoten/);
  });

  it("maps exhausted credits (429) to quota, not rate limit", () => {
    const credits = Object.assign(
      new Error("429 You have no credits remaining. Add credits to continue using the API."),
      { status: 429, code: "credit_balance_exhausted" }
    );
    expect(describePipelineFailure(credits)).toMatch(/kvoten/);
  });

  it("maps auth and bad request model errors", () => {
    const auth = Object.assign(new Error("Incorrect API key"), { name: "AuthenticationError", status: 401 });
    expect(describePipelineFailure(auth)).toMatch(/autentisering/);
    const badModel = Object.assign(new Error("The model does not exist"), {
      name: "BadRequestError",
      status: 400
    });
    expect(describePipelineFailure(badModel)).toMatch(/ikke tilgjengelig/);
  });

  it("hides raw JSON dumps", () => {
    expect(describePipelineFailure(new Error('{"issues":[]}'), "Fallback.")).toBe("Fallback.");
  });
});

describe("PrepPipelineError", () => {
  it("keeps step metadata", () => {
    const error = new PrepPipelineError("company_report", "Rapport feilet.", new ZodError([]));
    expect(error.step).toBe("company_report");
    expect(error.cause).toBeInstanceOf(ZodError);
  });
});
