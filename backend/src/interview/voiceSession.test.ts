import { describe, expect, it } from "vitest";
import { createVoiceSession } from "./voiceSession.js";

describe("createVoiceSession", () => {
  it("returns mock credentials without API key", () => {
    const session = createVoiceSession({ OPENAI_API_KEY: undefined, OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.mock).toBe(true);
    expect(session.model).toBe("gpt-live-1");
    expect(session.clientSecret.startsWith("mock_voice_")).toBe(true);
  });

  it("returns ephemeral-shaped secret when key exists", () => {
    const session = createVoiceSession({ OPENAI_API_KEY: "sk-test", OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.mock).toBe(false);
    expect(session.clientSecret.startsWith("ek_voice_")).toBe(true);
  });
});
