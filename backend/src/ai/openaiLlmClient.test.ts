import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { createMock, parseMock, transcribeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  parseMock: vi.fn(),
  transcribeMock: vi.fn()
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      create: createMock,
      parse: parseMock
    };
    audio = {
      transcriptions: {
        create: transcribeMock
      }
    };
  }
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: () => ({ type: "json_schema", name: "structured_response" })
}));

import { OpenAiLlmClient } from "./openaiLlmClient.js";

const envBase = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_TEXT_MODEL: "gpt-test",
  OPENAI_TRANSCRIBE_MODEL: "gpt-transcribe",
  OPENAI_REASONING_EFFORT: "high" as const,
  OPENAI_FAST_MODE: false
};

describe("OpenAiLlmClient", () => {
  beforeEach(() => {
    createMock.mockReset();
    parseMock.mockReset();
    transcribeMock.mockReset();
  });

  it("reports unconfigured without API key", () => {
    const client = new OpenAiLlmClient({ ...envBase, OPENAI_API_KEY: "" });
    expect(client.isConfigured()).toBe(false);
  });

  it("throws when calling complete without configuration", async () => {
    const client = new OpenAiLlmClient({ ...envBase, OPENAI_API_KEY: "" });
    await expect(client.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /ikke konfigurert/i
    );
  });

  it("completes via Responses API", async () => {
    createMock.mockResolvedValue({ output_text: "  svar  " });
    const client = new OpenAiLlmClient(envBase);
    await expect(client.complete({ messages: [{ role: "user", content: "hi" }] })).resolves.toBe("svar");
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ model: "gpt-test" });
  });

  it("uses model override on complete and web search", async () => {
    createMock.mockResolvedValue({ output_text: "ok" });
    const client = new OpenAiLlmClient(envBase);
    await client.complete({ model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ model: "gpt-5.5" });
    await client.webSearch("DNB", { model: "gpt-6-luna" });
    expect(createMock.mock.calls[1]?.[0]).toMatchObject({ model: "gpt-6-luna" });
  });

  it("throws on empty complete response", async () => {
    createMock.mockResolvedValue({ output_text: "   " });
    const client = new OpenAiLlmClient(envBase);
    await expect(client.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/tomt svar/i);
  });

  it("parses structured responses", async () => {
    parseMock.mockResolvedValue({ output_parsed: { ok: true } });
    const client = new OpenAiLlmClient({ ...envBase, OPENAI_FAST_MODE: true });
    const schema = z.object({ ok: z.boolean() });
    await expect(
      client.completeStructured({ messages: [{ role: "system", content: "sys" }] }, schema)
    ).resolves.toEqual({ ok: true });
    expect(parseMock.mock.calls[0]?.[0]).toMatchObject({ service_tier: "priority" });
  });

  it("throws when structured parse is empty", async () => {
    parseMock.mockResolvedValue({ output_parsed: null });
    const client = new OpenAiLlmClient(envBase);
    await expect(
      client.completeStructured({ messages: [{ role: "user", content: "x" }] }, z.object({ a: z.string() }))
    ).rejects.toThrow(/ugyldig strukturert/i);
  });

  it("runs web search", async () => {
    createMock.mockResolvedValue({ output_text: "search hit" });
    const client = new OpenAiLlmClient(envBase);
    await expect(client.webSearch("DNB")).resolves.toBe("search hit");
  });

  it("transcribes audio buffers", async () => {
    transcribeMock.mockResolvedValue({ text: "  hello  " });
    const client = new OpenAiLlmClient(envBase);
    await expect(
      client.transcribe({ buffer: Buffer.from("audio"), filename: "a.webm", mimeType: "audio/webm" })
    ).resolves.toBe("hello");
  });

  it("throws on empty transcription", async () => {
    transcribeMock.mockResolvedValue({ text: " " });
    const client = new OpenAiLlmClient(envBase);
    await expect(client.transcribe({ buffer: Buffer.from("audio") })).rejects.toThrow(/tomt svar/i);
  });
});
