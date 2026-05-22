import type { BoardGraph, BoardViewport, CareerBoard, CareerBoardSummary } from "@careercenter/shared";
import { request } from "./client.js";

export interface BoardCreatePayload {
  name: string;
  description?: string;
  graph?: BoardGraph;
  isDefault?: boolean;
}

export interface BoardUpdatePayload {
  name?: string;
  description?: string;
  viewport?: BoardViewport | null;
  graph?: BoardGraph;
  isDefault?: boolean;
}

export const boardsApi = {
  boards: () => request<CareerBoardSummary[]>("/api/boards"),
  board: (id: string) => request<CareerBoard>(`/api/boards/${id}`),
  createBoard: (payload: BoardCreatePayload) =>
    request<CareerBoard>("/api/boards", { method: "POST", body: JSON.stringify(payload) }),
  updateBoard: (id: string, payload: BoardUpdatePayload) =>
    request<CareerBoard>(`/api/boards/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBoard: (id: string) => request<void>(`/api/boards/${id}`, { method: "DELETE" }),
  duplicateBoard: (id: string) => request<CareerBoard>(`/api/boards/${id}/duplicate`, { method: "POST" })
};
