import type { CareerTrack, CareerTrackSetting } from "@careercenter/shared";
import { request } from "./client.js";
import type { TrackPayload } from "../types/index.js";

export const careerMapApi = {
  tracks: () => request<CareerTrackSetting[]>("/api/career-tracks"),
  updateTrack: (id: CareerTrack, payload: TrackPayload) =>
    request<CareerTrackSetting>(`/api/career-tracks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  resetTrack: (id: CareerTrack) =>
    request<CareerTrackSetting>(`/api/career-tracks/${id}/reset`, { method: "POST" }),
  deleteTrack: (id: CareerTrack) => request<void>(`/api/career-tracks/${id}`, { method: "DELETE" })
};
