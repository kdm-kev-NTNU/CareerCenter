import { describe, expect, it } from "vitest";
import {
  canonicalizeDiscoveredAiResourcePath,
  chunkImportFiles,
  filesFromDirectoryInput,
  folderRootFromWebkitPath,
  isDiscoverableAiResourcePath,
  normalizeDiscoveryPath,
  stripFolderRootFromWebkitPath
} from "./aiResourceDiscovery.js";

describe("aiResourceDiscovery", () => {
  it("normalizes Windows paths", () => {
    expect(normalizeDiscoveryPath("\\.cursor\\rules\\foo.mdc")).toBe(".cursor/rules/foo.mdc");
  });

  it("accepts discoverable single files and rules", () => {
    expect(isDiscoverableAiResourcePath("AGENTS.md")).toBe(true);
    expect(isDiscoverableAiResourcePath(".cursorrules")).toBe(true);
    expect(isDiscoverableAiResourcePath(".cursor/mcp.json")).toBe(true);
    expect(isDiscoverableAiResourcePath(".codex/config.toml")).toBe(true);
    expect(isDiscoverableAiResourcePath(".cursor/rules/tailwind.mdc")).toBe(true);
    expect(isDiscoverableAiResourcePath(".cursor/skills/review/SKILL.md")).toBe(true);
    expect(isDiscoverableAiResourcePath(".codex/skills/deploy/SKILL.md")).toBe(true);
    expect(isDiscoverableAiResourcePath(".agents/skills/test/SKILL.md")).toBe(true);
    expect(isDiscoverableAiResourcePath(".agent-inventory/skills/user/readme-updater/SKILL.md")).toBe(true);
    expect(isDiscoverableAiResourcePath(".agent-inventory/mcp/workspace/server/tools/foo.json")).toBe(false);
  });

  it("canonicalizes selected agent source roots", () => {
    expect(canonicalizeDiscoveredAiResourcePath("skills/user/readme-updater/SKILL.md", ".agent-inventory"))
      .toBe(".agent-inventory/skills/user/readme-updater/SKILL.md");
    expect(canonicalizeDiscoveredAiResourcePath("user/readme-updater/SKILL.md", "skills"))
      .toBe(".agent-inventory/skills/user/readme-updater/SKILL.md");
    expect(canonicalizeDiscoveredAiResourcePath("skills/code-review/SKILL.md", ".agents"))
      .toBe(".agents/skills/code-review/SKILL.md");
    expect(canonicalizeDiscoveredAiResourcePath("code-review/SKILL.md", "skills"))
      .toBe(".agents/skills/code-review/SKILL.md");
  });

  it("rejects unrelated paths", () => {
    expect(isDiscoverableAiResourcePath("node_modules/foo.md")).toBe(false);
    expect(isDiscoverableAiResourcePath("README.md")).toBe(false);
    expect(isDiscoverableAiResourcePath("tailwind.mdc")).toBe(false);
    expect(isDiscoverableAiResourcePath(".cursor/skills/review/README.md")).toBe(false);
  });

  it("strips webkit folder root", () => {
    expect(stripFolderRootFromWebkitPath("CareerCenter/.cursor/rules/foo.mdc")).toBe(".cursor/rules/foo.mdc");
    expect(folderRootFromWebkitPath("CareerCenter/.cursor/rules/foo.mdc")).toBe("CareerCenter");
  });

  it("filters directory input files", () => {
    const fileOne = new File(["# Agents"], "AGENTS.md");
    Object.defineProperty(fileOne, "webkitRelativePath", {
      value: "CareerCenter/AGENTS.md"
    });
    const fileTwo = new File(["# Readme"], "README.md");
    Object.defineProperty(fileTwo, "webkitRelativePath", {
      value: "CareerCenter/README.md"
    });
    const fileThree = new File(["# Rule"], "tailwind.mdc");
    Object.defineProperty(fileThree, "webkitRelativePath", {
      value: "CareerCenter/.cursor/rules/tailwind.mdc"
    });

    const list = [fileOne, fileTwo, fileThree] as unknown as FileList;
    const entries = filesFromDirectoryInput(list);
    expect(entries.map((entry) => entry.fileName)).toEqual(["AGENTS.md", ".cursor/rules/tailwind.mdc"]);
  });

  it("keeps canonical source paths for selected agent folders", () => {
    const inventorySkill = new File(["# Readme updater"], "SKILL.md");
    Object.defineProperty(inventorySkill, "webkitRelativePath", {
      value: ".agent-inventory/skills/user/readme-updater/SKILL.md"
    });
    const agentsSkill = new File(["# Code review"], "SKILL.md");
    Object.defineProperty(agentsSkill, "webkitRelativePath", {
      value: "skills/code-review/SKILL.md"
    });

    const list = [inventorySkill, agentsSkill] as unknown as FileList;
    const entries = filesFromDirectoryInput(list);
    expect(entries.map((entry) => entry.fileName)).toEqual([
      ".agent-inventory/skills/user/readme-updater/SKILL.md",
      ".agents/skills/code-review/SKILL.md"
    ]);
  });

  it("chunks import batches at 25", () => {
    const files = Array.from({ length: 30 }, (_, index) => index);
    expect(chunkImportFiles(files)).toEqual([
      Array.from({ length: 25 }, (_, index) => index),
      [25, 26, 27, 28, 29]
    ]);
  });
});
