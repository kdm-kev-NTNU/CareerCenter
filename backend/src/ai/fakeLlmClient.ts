import type { z } from "zod";
import type { LlmClient, LlmCompleteOptions } from "./llmClient.js";

export interface FakeLlmClientOptions {
  configured?: boolean;
  completeResult?: string;
  structuredResult?: unknown;
  webSearchResult?: string;
}

export class FakeLlmClient implements LlmClient {
  readonly completeCalls: LlmCompleteOptions[] = [];
  readonly structuredCalls: Array<{ options: LlmCompleteOptions; schema: z.ZodType }> = [];
  readonly webSearchCalls: string[] = [];

  private configured: boolean;
  private completeResult: string;
  private structuredResult: unknown;
  private webSearchResult: string;

  constructor(options: FakeLlmClientOptions = {}) {
    this.configured = options.configured ?? true;
    this.completeResult = options.completeResult ?? "fake completion";
    this.structuredResult = options.structuredResult ?? { ok: true };
    this.webSearchResult = options.webSearchResult ?? "fake search result";
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    this.completeCalls.push(options);
    return this.completeResult;
  }

  async completeStructured<T extends z.ZodType>(
    options: LlmCompleteOptions,
    schema: T
  ): Promise<z.infer<T>> {
    this.structuredCalls.push({ options, schema });
    return schema.parse(this.structuredResult);
  }

  async webSearch(query: string): Promise<string> {
    this.webSearchCalls.push(query);
    return this.webSearchResult;
  }
}
