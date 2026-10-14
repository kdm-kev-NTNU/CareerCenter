import { describe, expect, it } from "vitest";
import { mergeChunks } from "./videoRecording.js";

describe("videoRecording helpers", () => {
  it("merges recorder chunks into one blob", () => {
    const blob = mergeChunks([new Blob(["a"], { type: "video/webm" }), new Blob(["b"], { type: "video/webm" })]);
    expect(blob.type).toContain("video/webm");
    expect(blob.size).toBe(2);
  });
});
