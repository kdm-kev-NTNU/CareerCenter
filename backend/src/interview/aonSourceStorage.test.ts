import { describe, expect, it } from "vitest";
import { aonSourcePdfs } from "@careercenter/shared";
import { listAonSourcePdfs, resolveExistingAonSourcePath } from "./aonSourceStorage.js";

describe("aonSourceStorage", () => {
  it("resolves only catalog ids", async () => {
    expect(await resolveExistingAonSourcePath("not-a-real-id")).toBeNull();
    expect(await resolveExistingAonSourcePath("../etc/passwd")).toBeNull();
  });

  it("lists exactly the three catalog PDFs", async () => {
    const list = await listAonSourcePdfs();
    expect(list.map((item) => item.id)).toEqual(aonSourcePdfs.map((item) => item.id));
    expect(list).toHaveLength(3);
  });

  it("marks existing stoff/aon files as available when present", async () => {
    const resolved = await resolveExistingAonSourcePath("switch_challenge");
    expect(resolved).not.toBeNull();
    expect(resolved!.meta.filename).toBe(
      "practice-tasks-deductive-reasoning-switchchallenge.pdf"
    );
    // Local workspace has the copied PDFs under stoff/aon.
    expect(resolved!.available).toBe(true);
    expect(resolved!.absolutePath.replace(/\\/g, "/")).toMatch(
      /stoff\/aon\/practice-tasks-deductive-reasoning-switchchallenge\.pdf$/
    );
  });
});
