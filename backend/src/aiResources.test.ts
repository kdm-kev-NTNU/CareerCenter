import { describe, expect, it } from "vitest";
import {
  buildAiResourceExportBundle,
  inferAiResourceFromFile
} from "./aiResources.js";

describe("ai resource import and export helpers", () => {
  it("parses valid Cursor MDC frontmatter", () => {
    const resource = inferAiResourceFromFile({
      fileName: "tailwind.mdc",
      content: [
        "---",
        'description: "Tailwind rules"',
        'globs: "**/*.vue"',
        "alwaysApply: false",
        "---",
        "# Tailwind",
        "Use local component patterns."
      ].join("\n")
    });

    expect(resource.kind).toBe("cursor_rule");
    expect(resource.installPath).toBe(".cursor/rules/tailwind.mdc");
    expect(resource.frontmatter.description).toBe("Tailwind rules");
  });

  it("rejects invalid Cursor MDC frontmatter", () => {
    expect(() =>
      inferAiResourceFromFile({
        fileName: "broken.mdc",
        content: "---\ndescription: Missing fields\n---\n# Broken"
      })
    ).toThrow("globs");
  });

  it("exports MCP JSON to Cursor and Codex config files", () => {
    const resource = {
      id: "mcp-1",
      name: "MCP docs",
      kind: "mcp_server" as const,
      targetTools: ["cursor" as const, "codex" as const],
      status: "active" as const,
      tags: ["mcp"],
      installPath: "mcp.json",
      content: JSON.stringify({
        mcpServers: {
          docs: { command: "npx", args: ["docs-mcp"], env: { API_KEY: "${API_KEY}" } }
        }
      }),
      frontmatter: {},
      configFormat: "json" as const,
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    const bundle = buildAiResourceExportBundle([resource], "all");
    expect(bundle.files.map((file) => file.path)).toEqual([".codex/config.toml", ".cursor/mcp.json"]);
    expect(bundle.files.find((file) => file.path === ".codex/config.toml")?.content).toContain("[mcp_servers.docs]");
    expect(bundle.files.find((file) => file.path === ".codex/config.toml")?.writeStrategy).toBe("toml_managed_block");
    expect(bundle.files.find((file) => file.path === ".cursor/mcp.json")?.writeStrategy).toBe("json_mcp_merge");
  });

  it("exports Cursor rules and AGENTS.md with sync write strategies", () => {
    const cursorRule = {
      id: "rule-1",
      name: "Tailwind",
      kind: "cursor_rule" as const,
      targetTools: ["cursor" as const],
      status: "active" as const,
      tags: ["cursor"],
      installPath: ".cursor/rules/tailwind.mdc",
      content: "# Tailwind",
      frontmatter: { description: "Tailwind", globs: "**/*.vue", alwaysApply: false },
      configFormat: "mdc" as const,
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    const codexInstructions = {
      ...cursorRule,
      id: "agents-1",
      name: "AGENTS",
      kind: "codex_instruction" as const,
      targetTools: ["codex" as const],
      installPath: "AGENTS.md",
      content: "# Codex",
      frontmatter: {},
      configFormat: "markdown" as const
    };

    const bundle = buildAiResourceExportBundle([cursorRule, codexInstructions], "all");
    expect(bundle.files.find((file) => file.path === ".cursor/rules/tailwind.mdc")?.writeStrategy).toBe("replace");
    expect(bundle.files.find((file) => file.path === "AGENTS.md")?.writeStrategy).toBe("managed_markdown_block");
  });

  it("infers legacy .cursorrules as needs_review cursor rules", () => {
    const resource = inferAiResourceFromFile({
      fileName: ".cursorrules",
      content: "Always use TypeScript."
    });

    expect(resource.kind).toBe("cursor_rule");
    expect(resource.status).toBe("needs_review");
    expect(resource.installPath).toBe(".cursorrules");
    expect(resource.configFormat).toBe("plain");
  });

  it("infers Cursor and Codex SKILL.md files from path", () => {
    const cursorSkill = inferAiResourceFromFile({
      fileName: ".cursor/skills/review/SKILL.md",
      content: "# Review skill\nCheck tests."
    });
    expect(cursorSkill.kind).toBe("cursor_skill");
    expect(cursorSkill.targetTools).toEqual(["cursor"]);
    expect(cursorSkill.installPath).toBe(".cursor/skills/review/SKILL.md");

    const codexSkill = inferAiResourceFromFile({
      fileName: ".codex/skills/deploy/SKILL.md",
      content: "# Deploy skill\nShip safely."
    });
    expect(codexSkill.kind).toBe("codex_skill");
    expect(codexSkill.targetTools).toEqual(["codex"]);
  });

  it("infers agent-inventory skills with canonical install paths", () => {
    const cursorSkill = inferAiResourceFromFile({
      fileName: ".agent-inventory/skills/user/readme-updater/SKILL.md",
      content: "# Readme updater\nKeep docs fresh."
    });
    expect(cursorSkill.kind).toBe("cursor_skill");
    expect(cursorSkill.targetTools).toEqual(["cursor"]);
    expect(cursorSkill.installPath).toBe(".cursor/skills/readme-updater/SKILL.md");
    expect(cursorSkill.tags).toContain("inventory");
    expect(cursorSkill.tags).toContain("user");
    expect(cursorSkill.notes).toContain(".agent-inventory/skills/user/readme-updater/SKILL.md");

    const codexSkill = inferAiResourceFromFile({
      fileName: ".agent-inventory/skills/codex/use-railway/SKILL.md",
      content: "# Railway\nDeploy on Railway."
    });
    expect(codexSkill.kind).toBe("codex_skill");
    expect(codexSkill.targetTools).toEqual(["codex"]);
    expect(codexSkill.installPath).toBe(".codex/skills/use-railway/SKILL.md");
    expect(codexSkill.tags).toContain("codex");

    const pluginSkill = inferAiResourceFromFile({
      fileName: ".agent-inventory/skills/plugins/posthog/querying-posthog-data/SKILL.md",
      content: "# PostHog queries\nUse HogQL."
    });
    expect(pluginSkill.kind).toBe("cursor_skill");
    expect(pluginSkill.tags).toContain("plugins/posthog");
    expect(pluginSkill.installPath).toBe(".cursor/skills/querying-posthog-data/SKILL.md");
  });

  it("infers AGENTS.md as codex instructions", () => {
    const resource = inferAiResourceFromFile({
      fileName: "AGENTS.md",
      content: "# Project instructions\nRun lint."
    });

    expect(resource.kind).toBe("codex_instruction");
    expect(resource.name).toBe("Codex project instructions");
    expect(resource.installPath).toBe("AGENTS.md");
  });

  it("infers TOML MCP config for Codex", () => {
    const resource = inferAiResourceFromFile({
      fileName: ".codex/config.toml",
      content: "[mcp_servers.docs]\ncommand = \"npx\"\n"
    });

    expect(resource.kind).toBe("mcp_server");
    expect(resource.targetTools).toEqual(["codex"]);
    expect(resource.configFormat).toBe("toml");
  });

  it("falls back to prompt snippets for generic markdown", () => {
    const resource = inferAiResourceFromFile({
      fileName: "notes.md",
      content: "# Helper prompt\nBe concise."
    });

    expect(resource.kind).toBe("prompt_snippet");
    expect(resource.status).toBe("draft");
    expect(resource.targetTools).toEqual(["cursor", "codex"]);
    expect(resource.installPath).toBe("");
  });

  it("filters export bundles by target and workflow checklists", () => {
    const cursorOnly = baseResource({
      id: "rule-1",
      kind: "cursor_rule",
      targetTools: ["cursor"],
      installPath: ".cursor/rules/style.mdc",
      configFormat: "mdc",
      frontmatter: { description: "Style", globs: "**/*", alwaysApply: false }
    });
    const codexOnly = baseResource({
      id: "agents-1",
      kind: "codex_instruction",
      targetTools: ["codex"],
      installPath: "AGENTS.md",
      configFormat: "markdown",
      content: "# Codex"
    });
    const checklist = baseResource({
      id: "checklist-1",
      kind: "workflow_checklist",
      targetTools: ["cursor"],
      installPath: "",
      content: "- Run tests",
      configFormat: "markdown"
    });

    const cursorBundle = buildAiResourceExportBundle([cursorOnly, codexOnly, checklist], "cursor");
    expect(cursorBundle.files.map((file) => file.path)).toEqual([
      ".cursor/rules/style.mdc",
      ".cursor/workflows/review-checklist.md"
    ]);

    const codexBundle = buildAiResourceExportBundle([cursorOnly, codexOnly], "codex");
    expect(codexBundle.files.map((file) => file.path)).toEqual(["AGENTS.md"]);
  });
});

function baseResource(overrides: Partial<{
  id: string;
  name: string;
  kind: "cursor_rule" | "codex_instruction" | "workflow_checklist";
  targetTools: Array<"cursor" | "codex">;
  status: "active" | "archived";
  installPath: string;
  content: string;
  frontmatter: Record<string, unknown>;
  configFormat: "mdc" | "markdown";
}>) {
  return {
    id: "resource-1",
    name: "Review checklist",
    kind: "cursor_rule" as const,
    targetTools: ["cursor" as const],
    status: "active" as const,
    tags: [],
    installPath: ".cursor/rules/style.mdc",
    content: "# Style",
    frontmatter: {},
    configFormat: "mdc" as const,
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
