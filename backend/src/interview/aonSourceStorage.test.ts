import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { aonSourcePdfs, getAonSourcePdf } from "@careercenter/shared";
import { listAonSourcePdfs, resolveExistingAonSourcePath } from "./aonSourceStorage.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aon-source-"));
  tempDirs.push(dir);
  return dir;
}

describe("aonSourceStorage", () => {
  it("resolves only catalog ids", async () => {
    expect(await resolveExistingAonSourcePath("not-a-real-id")).toBeNull();
    expect(await resolveExistingAonSourcePath("../etc/passwd")).toBeNull();
  });

  it("lists exactly the three catalog PDFs", async () => {
    const root = await tempRoot();
    const list = await listAonSourcePdfs([root]);
    expect(list.map((item) => item.id)).toEqual(aonSourcePdfs.map((item) => item.id));
    expect(list).toHaveLength(3);
    expect(list.every((item) => item.available === false)).toBe(true);
  });

  it("marks a catalog file available only when it is readable under stoff/aon", async () => {
    const root = await tempRoot();
    const meta = getAonSourcePdf("switch_challenge");
    expect(meta).toBeDefined();

    const missing = await resolveExistingAonSourcePath("switch_challenge", [root]);
    expect(missing).not.toBeNull();
    expect(missing!.available).toBe(false);
    expect(missing!.meta.filename).toBe(meta!.filename);
    expect(missing!.absolutePath.replace(/\\/g, "/")).toMatch(
      /stoff\/aon\/practice-tasks-deductive-reasoning-switchchallenge\.pdf$/
    );

    const dir = path.join(root, "stoff", "aon");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, meta!.filename), "%PDF-1.4 fixture\n");

    const present = await resolveExistingAonSourcePath("switch_challenge", [root]);
    expect(present!.available).toBe(true);
    expect(present!.absolutePath.replace(/\\/g, "/")).toBe(
      missing!.absolutePath.replace(/\\/g, "/")
    );

    const list = await listAonSourcePdfs([root]);
    expect(list.find((item) => item.id === "switch_challenge")?.available).toBe(true);
    expect(list.filter((item) => item.available)).toHaveLength(1);
  });
});
