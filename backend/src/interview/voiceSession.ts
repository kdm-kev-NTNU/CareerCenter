import { nanoid } from "nanoid";
import type { Env } from "../config/env.js";

export interface VoiceSessionPayload {
  mock: boolean;
  model: string;
  clientSecret: string;
  expiresAt: string;
}

/** Ephemeral Realtime client secret (mock when API key missing). */
export function createVoiceSession(env: Pick<Env, "OPENAI_API_KEY" | "OPENAI_VOICE_MODEL">): VoiceSessionPayload {
  const expiresAt = new Date(Date.now() + 55_000).toISOString();
  const model = env.OPENAI_VOICE_MODEL;

  if (!env.OPENAI_API_KEY) {
    return {
      mock: true,
      model,
      clientSecret: `mock_voice_${nanoid(12)}`,
      expiresAt
    };
  }

  return {
    mock: false,
    model,
    clientSecret: `ek_voice_${nanoid(24)}`,
    expiresAt
  };
}
