import { afterEach, describe, expect, it, vi } from "vitest";
import { createVoiceSession } from "./voiceSession.js";

const envWithKey = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_VOICE_MODEL: "gpt-realtime-2.1",
  OPENAI_TRANSCRIBE_MODEL: "gpt-transcribe"
} as const;

describe("createVoiceSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns mock credentials without API key", async () => {
    const session = await createVoiceSession({
      OPENAI_API_KEY: undefined,
      OPENAI_VOICE_MODEL: "gpt-realtime-2.1",
      OPENAI_TRANSCRIBE_MODEL: "gpt-transcribe"
    });
    expect(session.mock).toBe(true);
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.clientSecret.startsWith("mock_voice_")).toBe(true);
    expect(session.tools.length).toBeGreaterThan(0);
    const endTool = session.tools.find((tool) => tool.name === "end_interview");
    expect(endTool?.description).toContain("Har du noen spørsmål til oss?");
  });

  it("never returns the API key when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ value: "ek_real", expires_at: 1_900_000_000 }) }))
    );
    const session = await createVoiceSession(envWithKey);
    expect(session.clientSecret).toBe("ek_real");
    expect(JSON.stringify(session)).not.toContain("sk-test");
  });

  it("enables input audio transcription so candidate speech is captured", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ value: "ek_real", expires_at: 1_900_000_000 })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await createVoiceSession(envWithKey);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const init = call![1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      session: {
        audio: { input: { transcription: { model: string; language: string } } };
      };
    };
    expect(body.session.audio.input.transcription).toEqual({
      model: "gpt-transcribe",
      language: "no"
    });
  });

  it("surfaces OpenAI errors instead of returning a fake secret", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad model" })));
    await expect(
      createVoiceSession({ ...envWithKey, OPENAI_VOICE_MODEL: "nope" })
    ).rejects.toThrow(/Realtime client secret feilet \(400\): bad model/);
  });
});
