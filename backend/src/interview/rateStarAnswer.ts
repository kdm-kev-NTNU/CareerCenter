import type { LlmClient } from "../ai/llmClient.js";
import {
  llmRubricOutputSchema,
  toFeedbackRubric,
  type InterviewFeedbackRubric
} from "./feedbackRubric.js";
import { buildFinishRubricPrompt } from "./prompts.js";

export type RubricResult =
  | { ok: true; feedback: InterviewFeedbackRubric }
  | { ok: false; reason: string };

export interface RateStarAnswerLog {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface RateStarAnswerOptions {
  signal?: AbortSignal;
  log?: RateStarAnswerLog;
  /** Extra retries after the first attempt (default 1). */
  maxRetries?: number;
  /** Optional per-call model override (falls back to env default). */
  model?: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Rates an interview answer with STAR rubric.
 * Retries once on transient/parse failures; never invents fake scores.
 */
export async function rateStarAnswer(
  llm: LlmClient,
  content: string,
  options: RateStarAnswerOptions = {}
): Promise<RubricResult> {
  const maxRetries = options.maxRetries ?? 1;
  let lastReason = "Ukjent feil";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal?.aborted) {
      return { ok: false, reason: "Avbrutt" };
    }
    try {
      const output = await llm.completeStructured(
        {
          messages: [
            { role: "system", content: buildFinishRubricPrompt() },
            { role: "user", content }
          ],
          signal: options.signal,
          model: options.model
        },
        llmRubricOutputSchema
      );
      return { ok: true, feedback: toFeedbackRubric(output) };
    } catch (error) {
      lastReason = errorReason(error);
      options.log?.warn(
        { err: error, attempt, maxRetries },
        "STAR-vurdering feilet"
      );
      if (isAbortError(error)) {
        return { ok: false, reason: lastReason };
      }
    }
  }

  return { ok: false, reason: lastReason };
}

export function buildRubricUserContent(prompt: string, transcript: string): string {
  const trimmedPrompt = prompt.trim();
  return trimmedPrompt ? `Spørsmål: ${trimmedPrompt}\n\nSvar: ${transcript}` : transcript;
}
