import { ZodError } from "zod";
import type { PrepPlanPipelineStep } from "@careercenter/shared";

/**
 * Domain failure for a prep-plan pipeline step.
 * Prefer this over raw SDK/Zod messages when the failure is known and actionable.
 */
export class PrepPipelineError extends Error {
  readonly step: PrepPlanPipelineStep;
  readonly cause?: unknown;

  constructor(step: PrepPlanPipelineStep, message: string, cause?: unknown) {
    super(message);
    this.name = "PrepPipelineError";
    this.step = step;
    this.cause = cause;
  }
}

function openAiErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("name" in error && typeof (error as { name: unknown }).name === "string") {
    return (error as { name: string }).name;
  }
  return undefined;
}

function openAiStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("status" in error && typeof (error as { status: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return undefined;
}

function openAiCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return undefined;
}

/** OpenAI reports exhausted billing as 429 too; it must not be shown as a transient rate limit. */
const QUOTA_CODES = new Set(["insufficient_quota", "credit_balance_exhausted", "billing_hard_limit_reached"]);

function openAiMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Maps raw failures to a short Norwegian reason stored on the plan.
 * Invariant: never returns empty; never dumps Zod/OpenAI JSON blobs.
 */
export function describePipelineFailure(error: unknown, fallback = "Plan-steg feilet."): string {
  if (error instanceof PrepPipelineError) return error.message;

  if (error instanceof ZodError) {
    return "Modellen returnerte svar i feil format. Prøv igjen, eller bytt til en sterkere modell.";
  }

  const name = openAiErrorName(error);
  const status = openAiStatus(error);
  const code = openAiCode(error);
  const message = openAiMessage(error).toLowerCase();

  if (
    status === 402 ||
    (code !== undefined && QUOTA_CODES.has(code)) ||
    message.includes("insufficient_quota") ||
    message.includes("quota") ||
    message.includes("no credits")
  ) {
    return "AI-kvoten er brukt opp. Fyll på kreditt hos OpenAI og fortsett fra steget som feilet.";
  }

  if (
    name === "APIConnectionTimeoutError" ||
    name === "TimeoutError" ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "Modellen brukte for lang tid og ble avbrutt. Fortsett fra steget som feilet.";
  }

  if (name === "RateLimitError" || status === 429 || message.includes("rate limit")) {
    return "For mange forespørsler mot AI-tjenesten. Vent litt og fortsett fra steget som feilet.";
  }

  if (
    name === "AuthenticationError" ||
    status === 401 ||
    message.includes("incorrect api key") ||
    message.includes("invalid api key")
  ) {
    return "AI-autentisering feilet. Sjekk at API-nøkkelen er satt riktig.";
  }

  if (name === "BadRequestError" || status === 400) {
    if (message.includes("model") || message.includes("does not exist")) {
      return "Valgt modell er ikke tilgjengelig. Velg en annen modell og start på nytt.";
    }
    if (message.includes("schema") || message.includes("format") || message.includes("json")) {
      return "Modellen klarte ikke å følge svarformatet. Prøv igjen med en sterkere modell.";
    }
    return "AI-forespørselen ble avvist. Prøv igjen, eller bytt modell.";
  }

  if (error instanceof Error && error.message.trim()) {
    const trimmed = error.message.trim();
    // Raw SDK/Zod dumps are not useful in the UI.
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.length > 280) {
      return fallback;
    }
    return trimmed;
  }

  return fallback;
}
