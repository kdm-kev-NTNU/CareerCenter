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
  dc.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        transcript?: string;
        name?: string;
        item?: { content?: Array<{ transcript?: string }> };
      };
      if (payload.type === "response.audio_transcript.done" && payload.transcript) {
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

  const response = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(input.model)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.clientSecret}`,
      "Content-Type": "application/sdp"
    },
    body: offer.sdp ?? ""
  });
  if (!response.ok) {
    pc.close();
    throw new Error(`Realtime-tilkobling feilet (${response.status}).`);
  }
  const answer = await response.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });

  return {
    pc,
    stop: () => {
      dc.close();
      pc.close();
      remoteAudio.srcObject = null;
    }
  };
}
