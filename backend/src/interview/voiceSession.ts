import { nanoid } from "nanoid";
import type { Env } from "../config/env.js";

export interface VoiceSessionPayload {
  mock: boolean;
  model: string;
  clientSecret: string;
  expiresAt: string;
  tools: Array<{ name: string; description: string }>;
}

const VOICE_TOOLS = [
  { name: "next_question", description: "Move to the next interview question." },
  {
    name: "end_interview",
    description:
      "End the interview when enough signal is gathered, and only after the closing round where the candidate asks their questions («Har du noen spørsmål til oss?») is finished."
  }
];

/** Ephemeral Realtime client secret. Never returns the API key. */
export async function createVoiceSession(
  env: Pick<Env, "OPENAI_API_KEY" | "OPENAI_VOICE_MODEL">,
  instructions?: string
): Promise<VoiceSessionPayload> {
  const expiresAt = new Date(Date.now() + 55_000).toISOString();
  const model = env.OPENAI_VOICE_MODEL;

  if (!env.OPENAI_API_KEY) {
    return {
      mock: true,
      model,
      clientSecret: `mock_voice_${nanoid(12)}`,
      expiresAt,
      tools: VOICE_TOOLS
    };
  }

  const sessionBody: Record<string, unknown> = {
    type: "realtime",
    model,
    tools: VOICE_TOOLS.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: { type: "object", properties: {} }
    }))
  };
  if (instructions?.trim()) {
    sessionBody.instructions = instructions.trim();
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ session: sessionBody })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Realtime client secret feilet (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    value?: string;
    client_secret?: { value?: string; expires_at?: number };
    expires_at?: number;
  };
  const secret = payload.value ?? payload.client_secret?.value;
  if (!secret) throw new Error("Realtime client secret mangler i svar.");

  const expSeconds = payload.expires_at ?? payload.client_secret?.expires_at;
  return {
    mock: false,
    model,
    clientSecret: secret,
    expiresAt: expSeconds ? new Date(expSeconds * 1000).toISOString() : expiresAt,
    tools: VOICE_TOOLS
  };
}
