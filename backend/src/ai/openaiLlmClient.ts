import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import type { Env } from "../config/env.js";
import type { LlmClient, LlmCompleteOptions } from "./llmClient.js";

export class OpenAiLlmClient implements LlmClient {
  private readonly client: OpenAI | null;
  private readonly textModel: string;

  constructor(env: Pick<Env, "OPENAI_API_KEY" | "OPENAI_TEXT_MODEL">) {
    this.textModel = env.OPENAI_TEXT_MODEL;
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    const client = this.requireClient();
    const response = await client.chat.completions.create({
      model: this.textModel,
      messages: options.messages,
      temperature: options.temperature
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returnerte tomt svar.");
    }
    return content;
  }

  async completeStructured<T extends z.ZodType>(
    options: LlmCompleteOptions,
    schema: T
  ): Promise<z.infer<T>> {
    const client = this.requireClient();
    const response = await client.chat.completions.parse({
      model: this.textModel,
      messages: options.messages,
      temperature: options.temperature,
      response_format: zodResponseFormat(schema, "structured_response")
    });
    const parsed = response.choices[0]?.message.parsed;
    if (parsed === undefined || parsed === null) {
      throw new Error("OpenAI returnerte ugyldig strukturert svar.");
    }
    return parsed;
  }

  async webSearch(query: string): Promise<string> {
    const client = this.requireClient();
    const response = await client.responses.create({
      model: this.textModel,
      tools: [{ type: "web_search_preview" }],
      input: query
    });
    const text = response.output_text;
    if (!text) {
      throw new Error("OpenAI web search returnerte tomt svar.");
    }
    return text;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new Error("OpenAI er ikke konfigurert (mangler OPENAI_API_KEY).");
    }
    return this.client;
  }
}
