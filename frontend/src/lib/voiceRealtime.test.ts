import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRealtimeVoice } from "./voiceRealtime.js";

function stubPeer() {
  const closeDc = vi.fn();
  const closePc = vi.fn();
  const addTrack = vi.fn();
  const handlers: {
    onmessage: ((event: MessageEvent) => void) | null;
    ontrack: ((event: RTCTrackEvent) => void) | null;
    onopen: (() => void) | null;
  } = {
    onmessage: null,
    ontrack: null,
    onopen: null
  };

  const sent: string[] = [];
  class FakeRTCPeerConnection {
    addTrack = addTrack;
    createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0" }));
    setLocalDescription = vi.fn(async () => undefined);
    setRemoteDescription = vi.fn(async () => undefined);
    close = closePc;
    createDataChannel = vi.fn(() => ({
      get onmessage() {
        return handlers.onmessage;
      },
      set onmessage(fn: ((event: MessageEvent) => void) | null) {
        handlers.onmessage = fn;
      },
      set onopen(fn: (() => void) | null) {
        handlers.onopen = fn;
      },
      send: (data: string) => sent.push(data),
      close: closeDc
    }));
    set ontrack(fn: ((event: RTCTrackEvent) => void) | null) {
      handlers.ontrack = fn;
    }
    get ontrack() {
      return handlers.ontrack;
    }
  }

  vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);
  vi.stubGlobal(
    "Audio",
    class {
      autoplay = false;
      srcObject: MediaStream | null = null;
    }
  );

  return { closeDc, closePc, addTrack, handlers, sent };
}

describe("connectRealtimeVoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("connects over WebRTC and handles transcript/tool events", async () => {
    const { closeDc, closePc, handlers, sent } = stubPeer();

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => "v=0 answer"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const transcripts: Array<{ role: string; text: string }> = [];
    const tools: string[] = [];
    const stream = {
      getTracks: () => [{ kind: "audio" }],
      getAudioTracks: () => [{ kind: "audio" }]
    } as unknown as MediaStream;

    const session = await connectRealtimeVoice({
      clientSecret: "ephemeral",
      model: "gpt-realtime-2.1",
      stream,
      onTranscript: (role, text) => transcripts.push({ role, text }),
      onToolCall: (name) => tools.push(name)
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer ephemeral" })
      })
    );

    handlers.onopen?.();
    expect(sent).toEqual([JSON.stringify({ type: "response.create" })]);

    handlers.ontrack?.({ streams: [stream] } as unknown as RTCTrackEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "response.output_audio_transcript.done", transcript: "assistant hi" })
    } as MessageEvent);
    handlers.onmessage?.({
      data: JSON.stringify({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "user hi"
      })
    } as MessageEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "response.function_call_arguments.done", name: "next_question" })
    } as MessageEvent);
    handlers.onmessage?.({ data: "not-json" } as MessageEvent);

    expect(transcripts).toEqual([
      { role: "assistant", text: "assistant hi" },
      { role: "user", text: "user hi" }
    ]);
    expect(tools).toEqual(["next_question"]);

    session.stop();
    expect(closeDc).toHaveBeenCalled();
    expect(closePc).toHaveBeenCalled();
  });

  it("maps speaking buffer events to onSpeaking", async () => {
    const { handlers } = stubPeer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "v=0 answer"
      }))
    );

    const speaking: Array<{ who: string; speaking: boolean }> = [];
    await connectRealtimeVoice({
      clientSecret: "ephemeral",
      model: "gpt-realtime-2.1",
      stream: {
        getTracks: () => [{ kind: "audio" }],
        getAudioTracks: () => [{ kind: "audio" }]
      } as unknown as MediaStream,
      onSpeaking: (who, isSpeaking) => speaking.push({ who, speaking: isSpeaking })
    });

    handlers.onmessage?.({
      data: JSON.stringify({ type: "output_audio_buffer.started" })
    } as MessageEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "output_audio_buffer.stopped" })
    } as MessageEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "input_audio_buffer.speech_started" })
    } as MessageEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "input_audio_buffer.speech_stopped" })
    } as MessageEvent);

    expect(speaking).toEqual([
      { who: "assistant", speaking: true },
      { who: "assistant", speaking: false },
      { who: "user", speaking: true },
      { who: "user", speaking: false }
    ]);
  });

  it("adds only audio tracks when the stream also has video", async () => {
    const { addTrack } = stubPeer();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "v=0 answer"
      }))
    );

    const audio = { kind: "audio", id: "a1" };
    const video = { kind: "video", id: "v1" };
    const stream = {
      getTracks: () => [audio, video],
      getAudioTracks: () => [audio]
    } as unknown as MediaStream;

    await connectRealtimeVoice({
      clientSecret: "ephemeral",
      model: "gpt-realtime-2.1",
      stream
    });

    expect(addTrack).toHaveBeenCalledTimes(1);
    expect(addTrack).toHaveBeenCalledWith(audio, stream);
  });

  it("closes the peer connection when Realtime HTTP fails", async () => {
    const closePc = vi.fn();
    class FakeRTCPeerConnection {
      addTrack = vi.fn();
      createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0" }));
      setLocalDescription = vi.fn(async () => undefined);
      close = closePc;
      createDataChannel = vi.fn(() => ({
        onmessage: null,
        close: vi.fn()
      }));
      ontrack = null;
    }
    vi.stubGlobal("RTCPeerConnection", FakeRTCPeerConnection);
    vi.stubGlobal(
      "Audio",
      class {
        autoplay = false;
        srcObject: MediaStream | null = null;
      }
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => "nope"
      }))
    );

    await expect(
      connectRealtimeVoice({
        clientSecret: "bad",
        model: "gpt-realtime-2.1",
        stream: {
          getTracks: () => [],
          getAudioTracks: () => []
        } as unknown as MediaStream
      })
    ).rejects.toThrow(/Realtime-tilkobling feilet \(401\): nope/);
    expect(closePc).toHaveBeenCalled();
  });
});
