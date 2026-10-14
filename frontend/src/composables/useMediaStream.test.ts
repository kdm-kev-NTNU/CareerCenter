import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaStream } from "./useMediaStream.js";

function mockTrack() {
  return { stop: vi.fn() };
}

describe("useMediaStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops tracks when getUserMedia resolves after release", async () => {
    let resolveMedia: (stream: MediaStream) => void = () => undefined;
    const track = mockTrack();
    const lateStream = { getTracks: () => [track] } as unknown as MediaStream;

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveMedia = resolve;
            })
        )
      }
    });

    const { acquire, release } = useMediaStream();
    const pending = acquire({ needCamera: true, needMicrophone: true });
    release();
    resolveMedia(lateStream);
    await pending;

    expect(track.stop).toHaveBeenCalled();
  });
});
