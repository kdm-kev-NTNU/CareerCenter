import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAudioRecorder,
  createVideoRecorder,
  loadVideoBlob,
  mergeChunks,
  saveVideoBlob
} from "./videoRecording.js";

describe("videoRecording helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("merges recorder chunks into one blob", () => {
    const blob = mergeChunks([new Blob(["a"], { type: "video/webm" }), new Blob(["b"], { type: "video/webm" })]);
    expect(blob.type).toContain("video/webm");
    expect(blob.size).toBe(2);
  });

  it("creates a MediaRecorder that forwards non-empty chunks", () => {
    const chunks: Blob[] = [];
    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      constructor(
        public stream: MediaStream,
        public options: { mimeType: string }
      ) {}
      static isTypeSupported(type: string) {
        return type.includes("vp8");
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const recorder = createVideoRecorder({} as MediaStream, (blob) => chunks.push(blob)) as MediaRecorder & {
      options: { mimeType: string };
    };
    expect(recorder.options.mimeType).toContain("vp8");
    recorder.ondataavailable?.({ data: new Blob(["x"], { type: "video/webm" }) } as BlobEvent);
    recorder.ondataavailable?.({ data: new Blob([], { type: "video/webm" }) } as BlobEvent);
    expect(chunks).toHaveLength(1);
  });

  it("creates an audio-only recorder from stream audio tracks", () => {
    const chunks: Blob[] = [];
    const audioTrack = { kind: "audio", id: "a1" };
    const stream = {
      getAudioTracks: () => [audioTrack]
    } as unknown as MediaStream;

    class FakeMediaRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      constructor(
        public stream: MediaStream,
        public options: { mimeType: string }
      ) {}
      static isTypeSupported(type: string) {
        return type.includes("opus");
      }
    }
    class FakeMediaStream {
      constructor(public tracks: unknown[]) {}
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("MediaStream", FakeMediaStream);

    const recorder = createAudioRecorder(stream, (blob) => chunks.push(blob)) as MediaRecorder & {
      options: { mimeType: string };
      stream: { tracks: unknown[] };
    };
    expect(recorder.options.mimeType).toContain("opus");
    expect(recorder.stream.tracks).toEqual([audioTrack]);
    recorder.ondataavailable?.({ data: new Blob(["a"], { type: "audio/webm" }) } as BlobEvent);
    expect(chunks).toHaveLength(1);
  });

  it("saves and loads blobs through IndexedDB", async () => {
    const store = new Map<string, Blob>();
    const db = {
      objectStoreNames: { contains: () => true },
      createObjectStore: vi.fn(),
      close: vi.fn(),
      transaction: () => {
        const tx: {
          oncomplete: (() => void) | null;
          onerror: (() => void) | null;
          objectStore: () => {
            put: (blob: Blob, key: string) => void;
            get: (key: string) => {
              result: Blob | undefined;
              onsuccess: (() => void) | null;
              onerror: (() => void) | null;
            };
          };
        } = {
          oncomplete: null,
          onerror: null,
          objectStore: () => ({
            put: (blob: Blob, key: string) => {
              store.set(key, blob);
              queueMicrotask(() => tx.oncomplete?.());
            },
            get: (key: string) => {
              const req: {
                result: Blob | undefined;
                onsuccess: (() => void) | null;
                onerror: (() => void) | null;
              } = {
                result: store.get(key),
                onsuccess: null,
                onerror: null
              };
              queueMicrotask(() => req.onsuccess?.());
              return req;
            }
          })
        };
        return tx;
      }
    };

    vi.stubGlobal("indexedDB", {
      open: () => {
        const req: {
          result: typeof db | null;
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
          onupgradeneeded: (() => void) | null;
        } = {
          result: null,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        };
        queueMicrotask(() => {
          req.result = db;
          req.onsuccess?.();
        });
        return req;
      }
    });

    const blob = new Blob(["clip"], { type: "video/webm" });
    await saveVideoBlob("run-1", blob);
    await expect(loadVideoBlob("run-1")).resolves.toBe(blob);
    await expect(loadVideoBlob("missing")).resolves.toBeNull();
  });
});