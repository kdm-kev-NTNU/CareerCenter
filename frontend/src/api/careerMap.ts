import type { CareerMapNode, CareerTrack, CareerTrackSetting } from "@careercenter/shared";
import { request } from "./client.js";
import type { MapNodePayload, TrackPayload } from "../types/index.js";

export const careerMapApi = {
  careerMap: () => request<{ nodes: CareerMapNode[]; tracks: CareerTrackSetting[] }>("/api/career-map"),
  updateMapNode: (id: string, payload: MapNodePayload) =>
    request<CareerMapNode>(`/api/career-map/nodes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  resetMapNode: (id: string) =>
    request<CareerMapNode>(`/api/career-map/nodes/${id}/reset`, { method: "POST" }),
  tracks: () => request<CareerTrackSetting[]>("/api/career-tracks"),
  updateTrack: (id: CareerTrack, payload: TrackPayload) =>
    request<CareerTrackSetting>(`/api/career-tracks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  resetTrack: (id: CareerTrack) =>
    request<CareerTrackSetting>(`/api/career-tracks/${id}/reset`, { method: "POST" }),
  deleteTrack: (id: CareerTrack) => request<void>(`/api/career-tracks/${id}`, { method: "DELETE" })
};
