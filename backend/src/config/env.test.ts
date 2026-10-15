import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv OpenAI defaults", () => {
  it("defaults to flagship text, realtime voice and gpt-transcribe", () => {
    const env = loadEnv({
      JWT_SECRET: "local-dev-only-secret-for-env-tests-32"
    } as NodeJS.ProcessEnv);
    expect(env.OPENAI_TEXT_MODEL).toBe("gpt-6-astra");
    expect(env.OPENAI_VOICE_MODEL).toBe("gpt-realtime-2.1");
    expect(env.OPENAI_TRANSCRIBE_MODEL).toBe("gpt-transcribe");
    expect(env.OPENAI_REASONING_EFFORT).toBe("high");
    expect(env.OPENAI_FAST_MODE).toBe(false);
  });
});
