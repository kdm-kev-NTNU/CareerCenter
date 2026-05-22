import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { CareerTrack, CareerTrackSetting } from "@careercenter/shared";
import { careerTracks, trackLabels } from "@careercenter/shared";
import { api } from "../api/index.js";
import { useBoardStore } from "./board.js";

export const useCareerMapStore = defineStore("careerMap", () => {
  const trackSettings = ref<CareerTrackSetting[]>([]);
  const editingTrackId = ref<CareerTrack | null>(null);
  const editingTrackLabel = ref("");

  const trackList = computed(() =>
    trackSettings.value.length
      ? trackSettings.value
      : careerTracks.map((track, index) => ({ id: track, label: trackLabels[track], sortOrder: index }))
  );
  const tracks = computed(() => trackList.value.map((track) => track.id));
  const selectedTrack = computed(() => trackList.value.find((track) => track.id === editingTrackId.value) ?? null);

  function trackName(track: CareerTrack) {
    return trackList.value.find((entry) => entry.id === track)?.label ?? trackLabels[track];
  }

  function setTracks(tracksFromApi: CareerTrackSetting[]) {
    trackSettings.value = tracksFromApi;
  }

  function openTrackEditor(track: CareerTrackSetting) {
    editingTrackId.value = track.id;
    editingTrackLabel.value = track.label;
  }

  function clearTrackEditor() {
    editingTrackId.value = null;
    editingTrackLabel.value = "";
  }

  async function saveTrackEditor() {
    if (!editingTrackId.value) return;
    const updated = await api.updateTrack(editingTrackId.value, {
      label: editingTrackLabel.value.trim() || selectedTrack.value?.label || ""
    });
    trackSettings.value = trackSettings.value.map((track) => (track.id === updated.id ? updated : track));
    clearTrackEditor();
  }

  async function resetTrackEditor() {
    if (!editingTrackId.value) return;
    const updated = await api.resetTrack(editingTrackId.value);
    trackSettings.value = trackSettings.value.map((track) => (track.id === updated.id ? updated : track));
    clearTrackEditor();
  }

  async function deleteTrack(track: CareerTrackSetting) {
    const label = trackName(track.id);
    const boardCount = useBoardStore().nodesForTrack(track.id).length;
    const boardHint =
      boardCount > 0
        ? ` Dette fjerner også ${boardCount} element${boardCount === 1 ? "" : "er"} fra det aktive brettet.`
        : "";
    if (!confirm(`Slette spor «${label}»?${boardHint}`)) return;
    useBoardStore().deleteNodesByTrack(track.id, { skipConfirm: true });
    await api.deleteTrack(track.id);
    trackSettings.value = trackSettings.value.filter((entry) => entry.id !== track.id);
    if (editingTrackId.value === track.id) clearTrackEditor();
  }

  return {
    trackSettings,
    editingTrackId,
    editingTrackLabel,
    trackList,
    tracks,
    selectedTrack,
    trackName,
    setTracks,
    openTrackEditor,
    clearTrackEditor,
    saveTrackEditor,
    resetTrackEditor,
    deleteTrack
  };
});
