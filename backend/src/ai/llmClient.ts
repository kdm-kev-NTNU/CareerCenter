import type { z } from "zod";

export type LlmMessageRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmCompleteOptions {
  messages: LlmMessage[];
  temperature?: number;
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
  webSearch?(query: string): Promise<string>;
  transcribe?(options: LlmTranscribeOptions): Promise<string>;
}
