import { ref, shallowRef } from "vue";

export type MediaStreamConstraintsInput = {
  audioDeviceId?: string;
  videoDeviceId?: string;
  needCamera?: boolean;
  needMicrophone?: boolean;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useMediaStream() {
  const stream = shallowRef<MediaStream | null>(null);
  const error = ref<string | null>(null);
  let generation = 0;

  function release() {
    generation += 1;
    const current = stream.value;
    stream.value = null;
    stopStream(current);
  }

  async function acquire(constraints: MediaStreamConstraintsInput) {
    const myGeneration = (generation += 1);
    stopStream(stream.value);
    stream.value = null;
    error.value = null;

    const needCamera = constraints.needCamera ?? true;
    const needMicrophone = constraints.needMicrophone ?? true;

    const mediaConstraints: MediaStreamConstraints = {};
    if (needMicrophone) {
      mediaConstraints.audio = constraints.audioDeviceId
        ? { deviceId: { exact: constraints.audioDeviceId } }
        : true;
    }
    if (needCamera) {
      mediaConstraints.video = constraints.videoDeviceId
        ? { deviceId: { exact: constraints.videoDeviceId } }
        : true;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      if (myGeneration !== generation) {
        stopStream(media);
        return;
      }
      stream.value = media;
    } catch (err) {
      if (myGeneration !== generation) return;
      const name = err instanceof DOMException ? err.name : "Error";
      if (name === "NotAllowedError") {
        error.value = "Tilgang nektet. Tillat kamera/mikrofon i nettleseren.";
      } else if (name === "NotFoundError") {
        error.value = "Fant ingen kamera- eller mikrofonenhet.";
      } else if (name === "NotReadableError") {
        error.value = "Enheten er opptatt av en annen app.";
      } else {
        error.value = "Kunne ikke starte kamera/mikrofon.";
      }
    }
  }

  return { stream, acquire, release, error };
}
