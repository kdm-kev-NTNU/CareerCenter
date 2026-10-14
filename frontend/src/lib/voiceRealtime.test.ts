import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRealtimeVoice } from "./voiceRealtime.js";

describe("connectRealtimeVoice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("connects over WebRTC and handles transcript/tool events", async () => {
    const closeDc = vi.fn();
    const closePc = vi.fn();
    const handlers: {
      onmessage: ((event: MessageEvent) => void) | null;
      ontrack: ((event: RTCTrackEvent) => void) | null;
    } = {
      onmessage: null,
      ontrack: null
    };

    class FakeRTCPeerConnection {
      addTrack = vi.fn();
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

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => "v=0 answer"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const transcripts: Array<{ role: string; text: string }> = [];
    const tools: string[] = [];
    const stream = {
      getTracks: () => [{ kind: "audio" }]
    } as unknown as MediaStream;

    const session = await connectRealtimeVoice({
      clientSecret: "ephemeral",
      model: "gpt-live-1",
      stream,
      onTranscript: (role, text) => transcripts.push({ role, text }),
      onToolCall: (name) => tools.push(name)
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("model=gpt-live-1"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer ephemeral" })
      })
    );

    handlers.ontrack?.({ streams: [stream] } as unknown as RTCTrackEvent);
    handlers.onmessage?.({
      data: JSON.stringify({ type: "response.audio_transcript.done", transcript: "assistant hi" })
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
        model: "gpt-live-1",
        stream: { getTracks: () => [] } as unknown as MediaStream
      })
    ).rejects.toThrow(/Realtime-tilkobling feilet \(401\)/);
    expect(closePc).toHaveBeenCalled();
  });
});
