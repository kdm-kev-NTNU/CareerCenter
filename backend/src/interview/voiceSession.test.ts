import { afterEach, describe, expect, it, vi } from "vitest";
import { createVoiceSession } from "./voiceSession.js";

describe("createVoiceSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns mock credentials without API key", async () => {
    const session = await createVoiceSession({ OPENAI_API_KEY: undefined, OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.mock).toBe(true);
    expect(session.model).toBe("gpt-live-1");
    expect(session.clientSecret.startsWith("mock_voice_")).toBe(true);
    expect(session.tools.length).toBeGreaterThan(0);
  });

  it("never returns the API key when configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ value: "ek_real", expires_at: 1_900_000_000 }) }))
    );
    const session = await createVoiceSession({ OPENAI_API_KEY: "sk-test", OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.clientSecret).toBe("ek_real");
    expect(JSON.stringify(session)).not.toContain("sk-test");
  });

  it("surfaces OpenAI errors instead of returning a fake secret", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad model" })));
    await expect(
      createVoiceSession({ OPENAI_API_KEY: "sk-test", OPENAI_VOICE_MODEL: "nope" })
    ).rejects.toThrow(/Realtime client secret feilet \(400\): bad model/);
  });
});
