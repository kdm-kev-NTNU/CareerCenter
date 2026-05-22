import { describe, expect, it, vi } from "vitest";
import { BOARD_DRAG_MIME, readBoardDragData, setBoardDragData } from "./boardDrag.js";

describe("boardDrag", () => {
  it("writes and reads company drag payloads", () => {
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "none"
    } as DataTransfer;

    setBoardDragData(dataTransfer, { kind: "company", companyId: "statkraft" });
    expect(data.get(BOARD_DRAG_MIME)).toContain("statkraft");
    expect(dataTransfer.effectAllowed).toBe("copy");

    expect(readBoardDragData(dataTransfer)).toEqual({ kind: "company", companyId: "statkraft" });
  });

  it("returns null for missing or invalid drag payloads", () => {
    const empty = { getData: () => "" } as DataTransfer;
    expect(readBoardDragData(empty)).toBeNull();

    const invalid = { getData: () => "not-json" } as DataTransfer;
    expect(readBoardDragData(invalid)).toBeNull();
  });
});
