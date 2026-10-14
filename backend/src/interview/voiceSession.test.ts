import { describe, expect, it } from "vitest";
import { createVoiceSession } from "./voiceSession.js";

describe("createVoiceSession", () => {
  it("returns mock credentials without API key", async () => {
    const session = await createVoiceSession({ OPENAI_API_KEY: undefined, OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.mock).toBe(true);
    expect(session.model).toBe("gpt-live-1");
    expect(session.clientSecret.startsWith("mock_voice_")).toBe(true);
    expect(session.tools.length).toBeGreaterThan(0);
  });

  it("never returns the API key when configured", async () => {
    const session = await createVoiceSession({ OPENAI_API_KEY: "sk-test", OPENAI_VOICE_MODEL: "gpt-live-1" });
    expect(session.clientSecret).not.toContain("sk-test");
    expect(JSON.stringify(session)).not.toContain("sk-test");
  });
});
