/**
 * Minimal WebRTC connect to OpenAI Realtime using an ephemeral client secret.
 * Never receives or stores the API key.
 */

export async function connectRealtimeVoice(input: {
  clientSecret: string;
  model: string;
  stream: MediaStream;
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onToolCall?: (name: string) => void;
}): Promise<{ pc: RTCPeerConnection; stop: () => void }> {
  const pc = new RTCPeerConnection();
  input.stream.getTracks().forEach((track) => pc.addTrack(track, input.stream));

  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  pc.ontrack = (event) => {
    remoteAudio.srcObject = event.streams[0] ?? null;
  };

  const dc = pc.createDataChannel("oai-events");
  dc.onopen = () => {
    // Ephemeral sessions wait for a client trigger; kick off the interviewer intro.
    try {
      dc.send(JSON.stringify({ type: "response.create" }));
    } catch {
      // Channel may close during teardown.
    }
  };
  dc.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        transcript?: string;
        name?: string;
        item?: { content?: Array<{ transcript?: string }> };
      };
      const isAssistantTranscript =
        payload.type === "response.output_audio_transcript.done" || payload.type === "response.audio_transcript.done";
      if (isAssistantTranscript && payload.transcript) {
        input.onTranscript?.("assistant", payload.transcript);
      }
      if (payload.type === "conversation.item.input_audio_transcription.completed" && payload.transcript) {
        input.onTranscript?.("user", payload.transcript);
      }
      if (payload.type === "response.function_call_arguments.done" && payload.name) {
        input.onToolCall?.(payload.name);
      }
    } catch {
      // ignore malformed events
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // GA client secrets (from /v1/realtime/client_secrets) must use /calls; the model is bound to the secret.
  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.clientSecret}`,
      "Content-Type": "application/sdp"
    },
    body: offer.sdp ?? ""
  });
  const bodyText = await response.text().catch(() => "");
  if (!response.ok) {
    pc.close();
    const suffix = bodyText ? `: ${bodyText.slice(0, 200)}` : ".";
    throw new Error(`Realtime-tilkobling feilet (${response.status})${suffix}`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: bodyText });

  return {
    pc,
    stop: () => {
      dc.close();
      pc.close();
      remoteAudio.srcObject = null;
    }
  };
}
