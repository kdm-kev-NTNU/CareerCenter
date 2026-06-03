import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncAiResources } from "./ai-resource-sync.mjs";

const tempDirs = [];
const now = "2026-06-03T10:00:00.000Z";

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("ai-resource-sync CLI core", () => {
  it("runs dry-run without writing files", async () => {
    const cwd = await tempDir();
    const result = await syncAiResources({
      cwd,
      now,
      bundle: bundle([
        exportFile(".cursor/rules/tailwind.mdc", "---\ndescription: \"Tailwind\"\nglobs: \"**/*.vue\"\nalwaysApply: false\n---\n# Rule")
      ])
    });

    expect(result.dryRun).toBe(true);
    expect(result.files[0].action).toBe("create");
    await expect(readFile(path.join(cwd, ".cursor/rules/tailwind.mdc"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("applies replace files and backs up owned updates", async () => {
    const cwd = await tempDir();
    await syncAiResources({
      cwd,
      yes: true,
      now,
      bundle: bundle([exportFile(".cursor/rules/tailwind.mdc", "# v1\n")])
    });

    const second = await syncAiResources({
      cwd,
      yes: true,
      now: "2026-06-03T10:05:00.000Z",
      bundle: bundle([exportFile(".cursor/rules/tailwind.mdc", "# v2\n")])
    });

    await expect(readFile(path.join(cwd, ".cursor/rules/tailwind.mdc"), "utf8")).resolves.toBe("# v2\n");
    await expect(readFile(path.join(second.backupRoot, ".cursor/rules/tailwind.mdc"), "utf8")).resolves.toBe("# v1\n");

    const manifest = JSON.parse(await readFile(path.join(cwd, ".careercenter/ai-sync.json"), "utf8"));
    expect(manifest.files[".cursor/rules/tailwind.mdc"].resourceIds).toEqual(["res-1"]);
  });

  it("rejects path traversal", async () => {
    const cwd = await tempDir();
    const result = await syncAiResources({
      cwd,
      yes: true,
      now,
      bundle: bundle([exportFile("../outside.md", "# no\n")])
    });

    expect(result.rejected[0].message).toContain("Path traversal");
    await expect(readFile(path.join(cwd, ".careercenter/ai-sync.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports conflicts for unknown replace targets", async () => {
    const cwd = await tempDir();
    await mkdir(path.join(cwd, ".cursor/rules"), { recursive: true });
    await writeFile(path.join(cwd, ".cursor/rules/tailwind.mdc"), "# manual\n", "utf8");

    const result = await syncAiResources({
      cwd,
      yes: true,
      now,
      bundle: bundle([exportFile(".cursor/rules/tailwind.mdc", "# managed\n")])
    });

    expect(result.conflicts).toHaveLength(1);
    await expect(readFile(path.join(cwd, ".cursor/rules/tailwind.mdc"), "utf8")).resolves.toBe("# manual\n");
  });

  it("replaces CareerCenter-managed markdown blocks and preserves manual text", async () => {
    const cwd = await tempDir();
    await writeFile(
      path.join(cwd, "AGENTS.md"),
      [
        "# Manual instructions",
        "",
        "<!-- BEGIN CAREERCENTER AI RESOURCES -->",
        "old",
        "<!-- END CAREERCENTER AI RESOURCES -->",
        ""
      ].join("\n"),
      "utf8"
    );

    await syncAiResources({
      cwd,
      yes: true,
      now,
      bundle: bundle([
        exportFile("AGENTS.md", "new codex instruction\n", "managed_markdown_block")
      ])
    });

    const content = await readFile(path.join(cwd, "AGENTS.md"), "utf8");
    expect(content).toContain("# Manual instructions");
    expect(content).toContain("new codex instruction");
    expect(content).not.toContain("\nold\n");
  });

  it("merges Cursor MCP JSON and tracks owned server names", async () => {
    const cwd = await tempDir();
    await mkdir(path.join(cwd, ".cursor"), { recursive: true });
    await writeFile(
      path.join(cwd, ".cursor/mcp.json"),
      JSON.stringify({ mcpServers: { manual: { command: "manual-mcp" } } }, null, 2),
      "utf8"
    );

    await syncAiResources({
      cwd,
      yes: true,
      now,
      bundle: bundle([
        exportFile(
          ".cursor/mcp.json",
          JSON.stringify({ mcpServers: { docs: { command: "npx", args: ["docs-mcp"] } } }),
          "json_mcp_merge"
        )
      ])
    });

    const mcp = JSON.parse(await readFile(path.join(cwd, ".cursor/mcp.json"), "utf8"));
    expect(mcp.mcpServers.manual.command).toBe("manual-mcp");
    expect(mcp.mcpServers.docs.args).toEqual(["docs-mcp"]);

    const manifest = JSON.parse(await readFile(path.join(cwd, ".careercenter/ai-sync.json"), "utf8"));
    expect(manifest.ownedMcpServers[".cursor/mcp.json"]).toEqual(["docs"]);
  });
});

async function tempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "careercenter-ai-sync-"));
  tempDirs.push(dir);
  return dir;
}

function bundle(files) {
  return { target: "all", files };
}

function exportFile(filePath, content, writeStrategy = "replace") {
  return {
    path: filePath,
    content,
    resourceIds: ["res-1"],
    resourceNames: ["Resource"],
    writeStrategy
  };
}
