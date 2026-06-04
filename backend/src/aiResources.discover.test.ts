import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverAiResourceFiles } from "./aiResources.js";

describe("discoverAiResourceFiles", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeProject(structure: Record<string, string>) {
    const root = await mkdtemp(path.join(tmpdir(), "cc-discover-"));
    tempDirs.push(root);
    for (const [relative, content] of Object.entries(structure)) {
      const abs = path.join(root, relative);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
    }
    return root;
  }

  it("discovers skills under .agent-inventory/skills", async () => {
    const cwd = await makeProject({
      ".agent-inventory/skills/user/foo/SKILL.md": "# Foo\nSkill body.",
      ".agent-inventory/skills/codex/bar/SKILL.md": "# Bar\nCodex skill.",
      ".agent-inventory/mcp/workspace/server/tools/action.json": '{"name":"action"}'
    });

    const discovered = await discoverAiResourceFiles(cwd);
    const names = discovered.map((file) => file.fileName).sort();

    expect(names).toEqual([
      ".agent-inventory/skills/codex/bar/SKILL.md",
      ".agent-inventory/skills/user/foo/SKILL.md"
    ]);
  });

  it("still discovers standard .cursor and .codex skill paths", async () => {
    const cwd = await makeProject({
      ".cursor/skills/review/SKILL.md": "# Review\n",
      ".codex/skills/deploy/SKILL.md": "# Deploy\n"
    });

    const discovered = await discoverAiResourceFiles(cwd);
    const names = discovered.map((file) => file.fileName).sort();

    expect(names).toEqual([".codex/skills/deploy/SKILL.md", ".cursor/skills/review/SKILL.md"]);
  });
});
