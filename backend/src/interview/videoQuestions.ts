import { z } from "zod";
import type { LlmClient, LlmMessage } from "../ai/llmClient.js";

export interface VideoQuestionsPromptInput {
  companyName: string;
  roleDescription: string;
  count: number;
}

export type VideoQuestionsResult =
  | { ok: true; questions: string[] }
  | { ok: false; reason: string };

export interface GenerateVideoQuestionsLog {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface GenerateVideoQuestionsOptions {
  signal?: AbortSignal;
  log?: GenerateVideoQuestionsLog;
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

function normalizeQuestion(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function questionsAreDistinct(questions: string[]): boolean {
  const seen = new Set<string>();
  for (const question of questions) {
    const key = normalizeQuestion(question).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
  }
  return seen.size === questions.length;
}

export function videoQuestionsOutputSchema(count: number) {
  return z.object({
    questions: z.array(z.string().trim().min(1)).length(count)
  });
}

export function buildVideoQuestionsPrompt(input: VideoQuestionsPromptInput): {
  system: string;
  user: string;
  messages: LlmMessage[];
} {
  const system = [
    "Du lager spørsmål til en videosøknad / videointervju på norsk.",
    "Spørsmålene skal være atferds- eller motivasjonsbaserte (STAR der det passer).",
    "Hvert spørsmål skal være kort nok til å leses under betenkningstid (én til to setninger).",
    "Tilpass spørsmålene til bedriften og rollen når kontekst er gitt.",
    "Returner kun strukturert output med eksakt antall spørsmål.",
    "Spørsmålene må være ulike og ikke gjenta samme vinkling."
  ].join(" ");

  const roleBlock = input.roleDescription.trim()
    ? input.roleDescription.trim()
    : "(ikke oppgitt)";

  const user = [
    `Bedrift: ${input.companyName.trim()}`,
    `Rollebeskrivelse: ${roleBlock}`,
    `Antall spørsmål: ${input.count}`,
    "",
    "Lag spørsmålene nå."
  ].join("\n");

  return {
    system,
    user,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };
}

/**
 * Generates video-interview questions tailored to company/role.
 * Retries once on transient/parse/duplicate failures; never invents fallback prompts.
 */
export async function generateVideoQuestions(
  llm: LlmClient,
  input: VideoQuestionsPromptInput,
  options: GenerateVideoQuestionsOptions = {}
): Promise<VideoQuestionsResult> {
  const maxRetries = options.maxRetries ?? 1;
  const prompt = buildVideoQuestionsPrompt(input);
  const schema = videoQuestionsOutputSchema(input.count);
  let lastReason = "Ukjent feil";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (options.signal?.aborted) {
      return { ok: false, reason: "Avbrutt" };
    }
    try {
      const output = await llm.completeStructured(
        {
          messages: prompt.messages,
          signal: options.signal,
          model: options.model
        },
        schema
      );
      const questions = output.questions.map(normalizeQuestion);
      if (!questionsAreDistinct(questions)) {
        throw new Error("Spørsmålene var ikke unike.");
      }
      return { ok: true, questions };
    } catch (error) {
      lastReason = errorReason(error);
      options.log?.warn(
        { err: error, attempt, maxRetries },
        "Video-spørsmålsgenerering feilet"
      );
      if (isAbortError(error)) {
        return { ok: false, reason: lastReason };
      }
    }
  }

  return { ok: false, reason: lastReason };
}
