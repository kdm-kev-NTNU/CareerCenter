import type { AiResourceKind, AiResourceTargetTool } from "@careercenter/shared";

export const AI_RESOURCE_DEFAULT_FOLDER = "Inbox";

type ClassifiableAiResource = {
  name: string;
  kind: AiResourceKind;
  targetTools: AiResourceTargetTool[];
  tags: string[];
  installPath: string;
  content: string;
  notes: string;
  sourcePath?: string;
  folderPath?: string;
};

type Rule = {
  folderPath: string;
  keywords: string[];
};

const keywordRules: Rule[] = [
  {
    folderPath: "Accessibility/WCAG",
    keywords: ["wcag", "accessibility", "a11y", "universell utforming", "uu", "aria"]
  },
  {
    folderPath: "Startup/Websites",
    keywords: ["startup", "oppstart", "landing page", "landing", "site launch", "nettside", "website", "brand page", "product page"]
  },
  {
    folderPath: "Development/Code Quality",
    keywords: ["ci/cd", "ci cd", "testing", "test coverage", "coverage", "lint", "refactor", "review", "code quality", "pull request"]
  },
  {
    folderPath: "Security/Compliance",
    keywords: ["owasp", "secret", "secrets", "snyk", "semgrep", "security", "compliance", "vulnerability"]
  },
  {
    folderPath: "Deployment/Infrastructure",
    keywords: ["railway", "docker", "deploy", "deployment", "infrastructure", "env", "ops", "hosting"]
  },
  {
    folderPath: "Design/Figma",
    keywords: ["figma", "figjam", "design system", "ui generation", "design-to-code", "variables"]
  },
  {
    folderPath: "Data/Analytics",
    keywords: ["posthog", "sql", "hogql", "metrics", "analytics", "product analytics", "warehouse"]
  }
];

export function classifyAiResourceFolder(resource: ClassifiableAiResource): string {
  if (resource.folderPath?.trim()) return normalizeFolderPath(resource.folderPath);

  const source = `${resource.sourcePath ?? ""} ${resource.installPath} ${resource.notes}`.toLowerCase();
  if (resource.kind === "mcp_server" || source.includes("/mcp/") || source.includes(".cursor/mcp.json") || source.includes(".codex/config.toml")) {
    return "MCP/Connectors";
  }

  const haystack = [
    resource.name,
    resource.kind,
    resource.installPath,
    resource.notes,
    resource.sourcePath ?? "",
    resource.content,
    ...resource.tags,
    ...resource.targetTools
  ].join(" ").toLowerCase();

  for (const rule of keywordRules) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.folderPath;
    }
  }

  if (
    source.includes(".agents/skills/") ||
    source.includes(".codex/skills/") ||
    source.includes(".agent-inventory/skills/agents/") ||
    source.includes(".agent-inventory/skills/codex/") ||
    resource.kind === "codex_skill" ||
    resource.kind === "codex_instruction"
  ) {
    return "AI Agents/Skills";
  }

  return AI_RESOURCE_DEFAULT_FOLDER;
}

export function normalizeFolderPath(value: string): string {
  const normalized = value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return normalized || AI_RESOURCE_DEFAULT_FOLDER;
}
