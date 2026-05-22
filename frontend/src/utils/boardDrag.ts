export const BOARD_DRAG_MIME = "application/x-career-board-node";

export type BoardDragPayload =
  | { kind: "company"; companyId: string }
  | { kind: "milestone"; label: string }
  | { kind: "note"; text: string };

export function setBoardDragData(dataTransfer: DataTransfer, payload: BoardDragPayload) {
  dataTransfer.setData(BOARD_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.effectAllowed = "copy";
}

export function readBoardDragData(dataTransfer: DataTransfer): BoardDragPayload | null {
  const raw = dataTransfer.getData(BOARD_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BoardDragPayload;
  } catch {
    return null;
  }
}
