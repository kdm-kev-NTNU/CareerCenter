const DB_NAME = "careercenter-video-sim";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveVideoBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function loadVideoBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return blob;
}

export function createVideoRecorder(stream: MediaStream, onChunk: (blob: Blob) => void): MediaRecorder {
  const recorder = new MediaRecorder(stream, { mimeType: pickVideoMimeType() });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) onChunk(event.data);
  };
  return recorder;
}

/** Audio-only recorder for compact uploads (well under OpenAI's 25 MB limit). */
export function createAudioRecorder(stream: MediaStream, onChunk: (blob: Blob) => void): MediaRecorder {
  const audioOnly = new MediaStream(stream.getAudioTracks());
  const recorder = new MediaRecorder(audioOnly, { mimeType: pickAudioMimeType() });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) onChunk(event.data);
  };
  return recorder;
}

function pickVideoMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function pickAudioMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function mergeChunks(chunks: Blob[]): Blob {
  return new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
}
