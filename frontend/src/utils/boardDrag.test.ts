import { describe, expect, it } from "vitest";
import { BOARD_DRAG_MIME, readBoardDragData, setBoardDragData } from "./boardDrag.js";

describe("boardDrag", () => {
  it("writes and reads company drag payloads", () => {
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "none"
    } as unknown as DataTransfer;

    setBoardDragData(dataTransfer, { kind: "company", companyId: "statkraft" });
    expect(data.get(BOARD_DRAG_MIME)).toContain("statkraft");
    expect(dataTransfer.effectAllowed).toBe("copy");

    expect(readBoardDragData(dataTransfer)).toEqual({ kind: "company", companyId: "statkraft" });
  });

  it("writes and reads milestone and note drag payloads", () => {
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "none"
    } as unknown as DataTransfer;

    setBoardDragData(dataTransfer, { kind: "milestone", label: "Offer" });
    expect(readBoardDragData(dataTransfer)).toEqual({ kind: "milestone", label: "Offer" });

    setBoardDragData(dataTransfer, { kind: "note", text: "Follow up" });
    expect(readBoardDragData(dataTransfer)).toEqual({ kind: "note", text: "Follow up" });
  });

  it("returns null for missing or invalid drag payloads", () => {
    const empty = { getData: () => "" } as unknown as DataTransfer;
    expect(readBoardDragData(empty)).toBeNull();

    const invalid = { getData: () => "not-json" } as unknown as DataTransfer;
    expect(readBoardDragData(invalid)).toBeNull();
  });
});
