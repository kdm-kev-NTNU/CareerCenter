import type { z } from "zod";

export type LlmMessageRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmCompleteOptions {
  messages: LlmMessage[];
  temperature?: number;
  /** Optional per-call model override (falls back to env default). */
  model?: string;
  /** Optional abort signal for cancellable long-running calls. */
  signal?: AbortSignal;
  /** Optional per-call timeout in ms (falls back to client default). */
  timeoutMs?: number;
}

export interface LlmWebSearchOptions {
  model?: string;
  signal?: AbortSignal;
  /** Optional per-call timeout in ms (falls back to client default). */
  timeoutMs?: number;
}

export interface LlmTranscribeOptions {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
}

export interface LlmClient {
  isConfigured(): boolean;
  complete(options: LlmCompleteOptions): Promise<string>;
  completeStructured<T extends z.ZodType>(
    options: LlmCompleteOptions,
    schema: T
  ): Promise<z.infer<T>>;
  webSearch?(query: string, options?: LlmWebSearchOptions): Promise<string>;
  transcribe?(options: LlmTranscribeOptions): Promise<string>;
}
