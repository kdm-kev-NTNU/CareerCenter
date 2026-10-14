import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { Env } from "../config/env.js";
import type { LlmClient, LlmCompleteOptions, LlmTranscribeOptions } from "./llmClient.js";

type OpenAiEnv = Pick<
  Env,
  | "OPENAI_API_KEY"
  | "OPENAI_TEXT_MODEL"
  | "OPENAI_TRANSCRIBE_MODEL"
  | "OPENAI_REASONING_EFFORT"
  | "OPENAI_FAST_MODE"
>;

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI | null;
  private readonly textModel: string;
  private readonly transcribeModel: string;
  private readonly reasoningEffort: Env["OPENAI_REASONING_EFFORT"];
  private readonly fastMode: boolean;

  constructor(env: OpenAiEnv) {
    this.textModel = env.OPENAI_TEXT_MODEL;
    this.transcribeModel = env.OPENAI_TRANSCRIBE_MODEL;
    this.reasoningEffort = env.OPENAI_REASONING_EFFORT;
    this.fastMode = env.OPENAI_FAST_MODE;
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    const client = this.requireClient();
    const response = await client.responses.create({
      model: this.textModel,
      input: toResponsesInput(options),
      reasoning: { effort: this.reasoningEffort },
      ...(this.fastMode ? { service_tier: "priority" as const } : {})
    });
    const text = response.output_text?.trim();
    if (!text) throw new Error("OpenAI returnerte tomt svar.");
    return text;
  }

  async completeStructured<T extends z.ZodType>(
    options: LlmCompleteOptions,
    schema: T
  ): Promise<z.infer<T>> {
    const client = this.requireClient();
    const response = await client.responses.parse({
      model: this.textModel,
      input: toResponsesInput(options),
      reasoning: { effort: this.reasoningEffort },
      text: { format: zodTextFormat(schema, "structured_response") },
      ...(this.fastMode ? { service_tier: "priority" as const } : {})
    });
    const parsed = response.output_parsed;
    if (parsed === undefined || parsed === null) {
      throw new Error("OpenAI returnerte ugyldig strukturert svar.");
    }
    return parsed;
  }

  async webSearch(query: string): Promise<string> {
    const client = this.requireClient();
    const response = await client.responses.create({
      model: this.textModel,
      tools: [{ type: "web_search" }],
      input: query,
      reasoning: { effort: this.reasoningEffort },
      ...(this.fastMode ? { service_tier: "priority" as const } : {})
    });
    const text = response.output_text?.trim();
    if (!text) throw new Error("OpenAI web search returnerte tomt svar.");
    return text;
  }

  async transcribe(options: LlmTranscribeOptions): Promise<string> {
    const client = this.requireClient();
    const bytes = new Uint8Array(options.buffer);
    const file = new File([bytes], options.filename ?? "audio.webm", {
      type: options.mimeType ?? "audio/webm"
    });
    const result = await client.audio.transcriptions.create({
      model: this.transcribeModel,
      file
    });
    const text = "text" in result ? String(result.text ?? "") : "";
    if (!text.trim()) throw new Error("OpenAI transkripsjon returnerte tomt svar.");
    return text.trim();
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new Error("OpenAI er ikke konfigurert (mangler OPENAI_API_KEY).");
    }
    return this.client;
  }
}

function toResponsesInput(options: LlmCompleteOptions): string {
  return options.messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
}
