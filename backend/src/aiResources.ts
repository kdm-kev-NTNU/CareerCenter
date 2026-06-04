import { readdir, readFile, stat } from "node:fs/promises";
import pathModule from "node:path";
import type {
  AiResource,
  AiResourceExportBundle,
  AiResourceExportFile,
  AiResourceExportTarget,
  AiResourceWriteStrategy
} from "@careercenter/shared";
import type { AiResourceInput } from "./repository.js";

export class AiResourceImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResourceImportError";
  }
}

type ImportFile = {
  fileName: string;
  content: string;
};

type McpServerConfig = Record<string, unknown>;

const DEFAULT_MDC_FRONTMATTER = {
  description: "Imported Cursor rule",
  globs: "**/*",
  alwaysApply: false
};

export function inferAiResourceFromFile(file: ImportFile): AiResourceInput {
  const fileName = normalizePath(file.fileName);
  const lower = fileName.toLowerCase();
  const base = basename(fileName);
  const content = file.content.replace(/\r\n/g, "\n");

  if (lower.endsWith(".mdc")) {
    const parsed = parseMdc(content);
    const description = typeof parsed.frontmatter.description === "string" ? parsed.frontmatter.description : "";
    return {
      name: description || titleFromPath(fileName),
      kind: "cursor_rule",
      targetTools: ["cursor"],
      status: "active",
      tags: ["cursor", "rules"],
      installPath: lower.includes(".cursor/rules/") ? fileName : `.cursor/rules/${base}`,
      content: parsed.content,
      frontmatter: parsed.frontmatter,
      configFormat: "mdc",
      notes: ""
    };
  }

  if (base.toLowerCase() === ".cursorrules") {
    return {
      name: "Legacy Cursor rules",
      kind: "cursor_rule",
      targetTools: ["cursor"],
      status: "needs_review",
      tags: ["cursor", "legacy"],
      installPath: ".cursorrules",
      content,
      frontmatter: DEFAULT_MDC_FRONTMATTER,
      configFormat: "plain",
      notes: "Importert fra legacy .cursorrules-format."
    };
  }

  if (base.toLowerCase() === "skill.md") {
    const isCursorSkill = lower.includes(".cursor/skills/");
    const kind = isCursorSkill ? "cursor_skill" : "codex_skill";
    const slug = slugify(extractMarkdownTitle(content) || parentFolderName(fileName) || "skill");
    return {
      name: extractMarkdownTitle(content) || titleFromPath(parentFolderName(fileName) || base),
      kind,
      targetTools: [isCursorSkill ? "cursor" : "codex"],
      status: "active",
      tags: [isCursorSkill ? "cursor" : "codex", "skill"],
      installPath: isCursorSkill
        ? fileName
        : lower.includes(".codex/skills/")
          ? fileName
          : `.codex/skills/${slug}/SKILL.md`,
      content,
      frontmatter: {},
      configFormat: "markdown",
      notes: ""
    };
  }

  if (base.toLowerCase() === "agents.md") {
    return {
      name: "Codex project instructions",
      kind: "codex_instruction",
      targetTools: ["codex"],
      status: "active",
      tags: ["codex", "instructions"],
      installPath: fileName.endsWith("AGENTS.md") ? fileName : "AGENTS.md",
      content,
      frontmatter: {},
      configFormat: "markdown",
      notes: ""
    };
  }

  if (lower.endsWith(".json") || looksLikeMcpJson(content)) {
    const parsed = parseMcpJson(content);
    const targetTools = inferMcpTargets(lower);
    return {
      name: mcpResourceName(parsed),
      kind: "mcp_server",
      targetTools,
      status: "active",
      tags: ["mcp", ...targetTools],
      installPath: targetTools.length === 1 && targetTools[0] === "cursor"
        ? ".cursor/mcp.json"
        : targetTools.length === 1 && targetTools[0] === "codex"
          ? ".codex/config.toml"
          : "mcp.json",
      content: JSON.stringify(parsed, null, 2),
      frontmatter: {},
      configFormat: "json",
      notes: ""
    };
  }

  if (lower.endsWith(".toml") || looksLikeCodexToml(content)) {
    return {
      name: "Codex config snippet",
      kind: "mcp_server",
      targetTools: ["codex"],
      status: "active",
      tags: ["codex", "mcp"],
      installPath: lower.endsWith(".toml") ? fileName : ".codex/config.toml",
      content,
      frontmatter: {},
      configFormat: "toml",
      notes: ""
    };
  }

  return {
    name: extractMarkdownTitle(content) || titleFromPath(fileName),
    kind: "prompt_snippet",
    targetTools: ["cursor", "codex"],
    status: "draft",
    tags: ["prompt"],
    installPath: "",
    content,
    frontmatter: {},
    configFormat: lower.endsWith(".md") ? "markdown" : "plain",
    notes: ""
  };
}

export function buildAiResourceExportBundle(
  resources: AiResource[],
  target: AiResourceExportTarget
): AiResourceExportBundle {
  const files = new Map<string, AiResourceExportFile>();
  const includeCursor = target === "cursor" || target === "all";
  const includeCodex = target === "codex" || target === "all";

  if (includeCursor) {
    addCursorFiles(files, resources.filter((resource) => resource.targetTools.includes("cursor")));
  }

  if (includeCodex) {
    addCodexFiles(files, resources.filter((resource) => resource.targetTools.includes("codex")));
  }

  return {
    target,
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
}

function addCursorFiles(files: Map<string, AiResourceExportFile>, resources: AiResource[]) {
  const mcpServers: Record<string, McpServerConfig> = {};
  const mcpSourceIds: string[] = [];
  const mcpSourceNames: string[] = [];

  for (const resource of resources) {
    if (resource.kind === "mcp_server") {
      if (resource.configFormat === "json") {
        mergeMcpServers(mcpServers, resource.content, resource.name);
        mcpSourceIds.push(resource.id);
        mcpSourceNames.push(resource.name);
      }
      continue;
    }

    if (resource.kind === "cursor_rule") {
      const path = resource.installPath || `.cursor/rules/${slugify(resource.name)}.mdc`;
      const content = resource.configFormat === "mdc"
        ? serializeMdc(resource.frontmatter, resource.content)
        : resource.content;
      addExportFile(files, path, content, resource, "replace");
      continue;
    }

    if (resource.kind === "cursor_skill") {
      addExportFile(files, resource.installPath || `.cursor/skills/${slugify(resource.name)}/SKILL.md`, resource.content, resource, "replace");
      continue;
    }

    if (resource.kind === "prompt_snippet") {
      addExportFile(files, resource.installPath || `.cursor/snippets/${slugify(resource.name)}.md`, resource.content, resource, "replace");
      continue;
    }

    if (resource.kind === "workflow_checklist") {
      addExportFile(files, resource.installPath || `.cursor/workflows/${slugify(resource.name)}.md`, resource.content, resource, "replace");
    }
  }

  if (Object.keys(mcpServers).length > 0) {
    files.set(".cursor/mcp.json", {
      path: ".cursor/mcp.json",
      content: `${JSON.stringify({ mcpServers }, null, 2)}\n`,
      resourceIds: mcpSourceIds,
      resourceNames: mcpSourceNames,
      writeStrategy: "json_mcp_merge"
    });
  }
}

function addCodexFiles(files: Map<string, AiResourceExportFile>, resources: AiResource[]) {
  const codexMcpServers: Record<string, McpServerConfig> = {};
  const mcpSourceIds: string[] = [];
  const mcpSourceNames: string[] = [];

  for (const resource of resources) {
    if (resource.kind === "mcp_server") {
      if (resource.configFormat === "toml") {
        addExportFile(files, resource.installPath || ".codex/config.toml", resource.content, resource, "toml_managed_block");
      } else if (resource.configFormat === "json") {
        mergeMcpServers(codexMcpServers, resource.content, resource.name);
        mcpSourceIds.push(resource.id);
        mcpSourceNames.push(resource.name);
      }
      continue;
    }

    if (resource.kind === "codex_instruction") {
      addExportFile(files, resource.installPath || "AGENTS.md", resource.content, resource, "managed_markdown_block");
      continue;
    }

    if (resource.kind === "codex_skill") {
      addExportFile(files, resource.installPath || `.codex/skills/${slugify(resource.name)}/SKILL.md`, resource.content, resource, "replace");
      continue;
    }

    if (resource.kind === "prompt_snippet") {
      addExportFile(files, resource.installPath || `.codex/prompts/${slugify(resource.name)}.md`, resource.content, resource, "replace");
      continue;
    }

    if (resource.kind === "workflow_checklist") {
      addExportFile(files, resource.installPath || `.codex/workflows/${slugify(resource.name)}.md`, resource.content, resource, "replace");
    }
  }

  if (Object.keys(codexMcpServers).length > 0) {
    files.set(".codex/config.toml", {
      path: ".codex/config.toml",
      content: serializeCodexMcpToml(codexMcpServers),
      resourceIds: mcpSourceIds,
      resourceNames: mcpSourceNames,
      writeStrategy: "toml_managed_block"
    });
  }
}

function addExportFile(
  files: Map<string, AiResourceExportFile>,
  path: string,
  content: string,
  resource: AiResource,
  writeStrategy: AiResourceWriteStrategy
) {
  const normalized = normalizePath(path);
  const existing = files.get(normalized);
  if (!existing) {
    files.set(normalized, {
      path: normalized,
      content: ensureTrailingNewline(content),
      resourceIds: [resource.id],
      resourceNames: [resource.name],
      writeStrategy
    });
    return;
  }

  files.set(normalized, {
    ...existing,
    content: `${existing.content.trimEnd()}\n\n---\n\n${content.trimEnd()}\n`,
    resourceIds: [...existing.resourceIds, resource.id],
    resourceNames: [...existing.resourceNames, resource.name],
    writeStrategy: existing.writeStrategy
  });
}

function parseMdc(content: string) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new AiResourceImportError(".mdc-filen mangler YAML-frontmatter.");
  }
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) {
    throw new AiResourceImportError(".mdc-filen mangler avsluttende frontmatter-markør.");
  }
  const frontmatter = parseSimpleYaml(normalized.slice(4, end));
  validateMdcFrontmatter(frontmatter);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  return { frontmatter, content: body };
}

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator < 1) {
      throw new AiResourceImportError(`Ugyldig frontmatter-linje: ${trimmed}`);
    }
    const key = trimmed.slice(0, separator).trim();
    parsed[key] = parseYamlScalar(trimmed.slice(separator + 1).trim());
  }
  return parsed;
}

function parseYamlScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return stripQuotes(value);
}

function stripQuotes(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function validateMdcFrontmatter(frontmatter: Record<string, unknown>) {
  if (typeof frontmatter.description !== "string" || !frontmatter.description.trim()) {
    throw new AiResourceImportError(".mdc-frontmatter må ha description.");
  }
  const globs = frontmatter.globs;
  const validGlobs = typeof globs === "string" || (Array.isArray(globs) && globs.every((glob) => typeof glob === "string"));
  if (!validGlobs) {
    throw new AiResourceImportError(".mdc-frontmatter må ha globs som string eller string-array.");
  }
  if (typeof frontmatter.alwaysApply !== "boolean") {
    throw new AiResourceImportError(".mdc-frontmatter må ha alwaysApply som boolean.");
  }
}

function serializeMdc(frontmatter: Record<string, unknown>, content: string) {
  const merged = normalizeMdcFrontmatter(frontmatter);
  validateMdcFrontmatter(merged);
  const globs = Array.isArray(merged.globs)
    ? `[${merged.globs.map((glob) => JSON.stringify(glob)).join(", ")}]`
    : JSON.stringify(merged.globs);
  return [
    "---",
    `description: ${JSON.stringify(merged.description)}`,
    `globs: ${globs}`,
    `alwaysApply: ${merged.alwaysApply === true ? "true" : "false"}`,
    "---",
    content.trimEnd(),
    ""
  ].join("\n");
}

function normalizeMdcFrontmatter(frontmatter: Record<string, unknown>) {
  const globs = frontmatter.globs;
  const validGlobs = typeof globs === "string" || (Array.isArray(globs) && globs.every((glob) => typeof glob === "string"));
  return {
    description: typeof frontmatter.description === "string" && frontmatter.description.trim()
      ? frontmatter.description
      : DEFAULT_MDC_FRONTMATTER.description,
    globs: validGlobs ? globs : DEFAULT_MDC_FRONTMATTER.globs,
    alwaysApply: typeof frontmatter.alwaysApply === "boolean"
      ? frontmatter.alwaysApply
      : DEFAULT_MDC_FRONTMATTER.alwaysApply
  };
}

function parseMcpJson(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
      throw new AiResourceImportError("MCP JSON må ha et mcpServers-objekt.");
    }
    return parsed as { mcpServers: Record<string, McpServerConfig> };
  } catch (error) {
    if (error instanceof AiResourceImportError) throw error;
    throw new AiResourceImportError("Ugyldig MCP JSON.");
  }
}

function mergeMcpServers(target: Record<string, McpServerConfig>, content: string, fallbackName: string) {
  const parsed = parseMcpJson(content);
  for (const [name, config] of Object.entries(parsed.mcpServers)) {
    target[name || slugify(fallbackName)] = config;
  }
}

function serializeCodexMcpToml(servers: Record<string, McpServerConfig>) {
  const blocks: string[] = [];
  for (const [name, config] of Object.entries(servers)) {
    const table = tomlMcpTable(name);
    const lines = [`[${table}]`];
    for (const key of ["command", "url", "cwd"] as const) {
      if (typeof config[key] === "string") {
        lines.push(`${key} = ${JSON.stringify(config[key])}`);
      }
    }
    if (Array.isArray(config.args)) {
      lines.push(`args = [${config.args.filter((arg) => typeof arg === "string").map((arg) => JSON.stringify(arg)).join(", ")}]`);
    }
    if (isRecord(config.env) && Object.keys(config.env).length > 0) {
      lines.push("", `[${table}.env]`);
      for (const [envKey, envValue] of Object.entries(config.env)) {
        if (typeof envValue === "string") {
          lines.push(`${envKey} = ${JSON.stringify(envValue)}`);
        }
      }
    }
    blocks.push(lines.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}

function tomlMcpTable(name: string) {
  return /^[A-Za-z0-9_-]+$/.test(name) ? `mcp_servers.${name}` : `mcp_servers.${JSON.stringify(name)}`;
}

function looksLikeMcpJson(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith("{") && trimmed.includes('"mcpServers"');
}

function looksLikeCodexToml(content: string) {
  return /^\s*\[mcp_servers[.\]]/m.test(content) || /^\s*\[mcpServers[.\]]/m.test(content);
}

function inferMcpTargets(path: string): Array<"cursor" | "codex"> {
  if (path.includes(".cursor/")) return ["cursor"];
  if (path.includes(".codex/") || path.includes("codex")) return ["codex"];
  return ["cursor", "codex"];
}

function mcpResourceName(parsed: { mcpServers: Record<string, unknown> }) {
  const names = Object.keys(parsed.mcpServers);
  if (names.length === 0) return "MCP servers";
  if (names.length <= 2) return `MCP: ${names.join(", ")}`;
  return `MCP: ${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function basename(path: string) {
  return normalizePath(path).split("/").filter(Boolean).pop() ?? path;
}

function parentFolderName(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : "";
}

function titleFromPath(path: string) {
  const base = basename(path).replace(/\.[^.]+$/, "");
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractMarkdownTitle(content: string) {
  const heading = content.split("\n").find((line) => /^#\s+/.test(line.trim()));
  return heading?.replace(/^#\s+/, "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "resource";
}

function ensureTrailingNewline(content: string) {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type DiscoveredFile = { fileName: string; content: string };

export async function discoverAiResourceFiles(cwd: string): Promise<DiscoveredFile[]> {
  const found: DiscoveredFile[] = [];

  const singleFiles: Array<{ relative: string; optional: boolean }> = [
    { relative: ".cursorrules", optional: true },
    { relative: "AGENTS.md", optional: true },
    { relative: ".cursor/mcp.json", optional: true },
    { relative: ".codex/config.toml", optional: true }
  ];

  for (const { relative } of singleFiles) {
    const abs = pathModule.resolve(cwd, relative);
    const content = await readTextSafe(abs);
    if (content !== null) found.push({ fileName: relative, content });
  }

  const globDirs: Array<{ dir: string; pattern: RegExp; recurse: boolean }> = [
    { dir: ".cursor/rules", pattern: /\.mdc$/i, recurse: false },
    { dir: ".cursor/skills", pattern: /^SKILL\.md$/i, recurse: true },
    { dir: ".codex/skills", pattern: /^SKILL\.md$/i, recurse: true },
    { dir: ".agents/skills", pattern: /^SKILL\.md$/i, recurse: true }
  ];

  for (const { dir, pattern, recurse } of globDirs) {
    const abs = pathModule.resolve(cwd, dir);
    await collectFiles(abs, dir, pattern, recurse, found);
  }

  return found;
}

async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function collectFiles(
  absDir: string,
  relativeBase: string,
  pattern: RegExp,
  recurse: boolean,
  out: DiscoveredFile[]
) {
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const rel = `${relativeBase}/${entry.name}`;
    if (entry.isFile() && pattern.test(entry.name)) {
      const content = await readTextSafe(pathModule.join(absDir, entry.name));
      if (content !== null) out.push({ fileName: rel, content });
    } else if (entry.isDirectory() && recurse) {
      await collectFiles(pathModule.join(absDir, entry.name), rel, pattern, recurse, out);
    }
  }
}
