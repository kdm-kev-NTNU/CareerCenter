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
});
