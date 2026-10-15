import type { z } from "zod";
import type {
  LlmClient,
  LlmCompleteOptions,
  LlmTranscribeOptions,
  LlmWebSearchOptions
} from "./llmClient.js";

export interface FakeLlmClientOptions {
  configured?: boolean;
  completeResult?: string;
  structuredResult?: unknown;
  structuredResults?: unknown[];
  structuredError?: Error;
  webSearchResult?: string;
  transcribeResult?: string;
}

export class FakeLlmClient implements LlmClient {
  readonly completeCalls: LlmCompleteOptions[] = [];
  readonly structuredCalls: Array<{ options: LlmCompleteOptions; schema: z.ZodType }> = [];
  readonly webSearchCalls: Array<{ query: string; options?: LlmWebSearchOptions }> = [];
  readonly transcribeCalls: LlmTranscribeOptions[] = [];

  private configured: boolean;
  private completeResult: string;
  private structuredResult: unknown;
  private structuredResults: unknown[];
  private structuredError?: Error;
  private webSearchResult: string;
  private transcribeResult: string;

  constructor(options: FakeLlmClientOptions = {}) {
    this.configured = options.configured ?? true;
    this.completeResult = options.completeResult ?? "fake completion";
    this.structuredResult = options.structuredResult ?? { ok: true };
    this.structuredResults = options.structuredResults ?? [];
    this.structuredError = options.structuredError;
    this.webSearchResult = options.webSearchResult ?? "fake search result";
    this.transcribeResult = options.transcribeResult ?? "fake transcript";
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    if (options.signal?.aborted) {
      throw Object.assign(new Error("Avbrutt"), { name: "AbortError" });
    }
    this.completeCalls.push(options);
    return this.completeResult;
  }

  async completeStructured<T extends z.ZodType>(
    options: LlmCompleteOptions,
    schema: T
  ): Promise<z.infer<T>> {
    if (options.signal?.aborted) {
      throw Object.assign(new Error("Avbrutt"), { name: "AbortError" });
    }
    this.structuredCalls.push({ options, schema });
    if (this.structuredError) throw this.structuredError;
    const next = this.structuredResults.shift() ?? this.structuredResult;
    return schema.parse(next);
  }

  async webSearch(query: string, options?: LlmWebSearchOptions): Promise<string> {
    if (options?.signal?.aborted) {
      throw Object.assign(new Error("Avbrutt"), { name: "AbortError" });
    }
    this.webSearchCalls.push({ query, options });
    return this.webSearchResult;
  }

  async transcribe(options: LlmTranscribeOptions): Promise<string> {
    this.transcribeCalls.push(options);
    return this.transcribeResult;
  }
}
