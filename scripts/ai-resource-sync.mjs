#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const VALID_TARGETS = new Set(["cursor", "codex", "all"]);
const VALID_WRITE_STRATEGIES = new Set([
  "replace",
  "managed_markdown_block",
  "json_mcp_merge",
  "toml_managed_block"
]);

const MARKDOWN_BEGIN = "<!-- BEGIN CAREERCENTER AI RESOURCES -->";
const MARKDOWN_END = "<!-- END CAREERCENTER AI RESOURCES -->";
const TOML_BEGIN = "# BEGIN CAREERCENTER AI RESOURCES";
const TOML_END = "# END CAREERCENTER AI RESOURCES";

export async function runCli(argv = process.argv.slice(2), io = process) {
  const options = parseArgs(argv);
  if (options.help) {
    io.stdout.write(helpText());
    return { exitCode: 0 };
  }

  const credentials = await resolveCredentials(options, io);
  const result = await syncAiResources({
    apiUrl: options.apiUrl,
    target: options.target,
    cwd: options.cwd,
    yes: options.yes,
    force: options.force,
    backup: options.backup,
    name: credentials.name,
    pin: credentials.pin,
    fetchFn: options.fetchFn
  });

  io.stdout.write(formatSummary(result));
  return { exitCode: result.conflicts.length || result.rejected.length ? 1 : 0 };
}

export async function syncAiResources(options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const target = options.target ?? "all";
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`Ugyldig target: ${target}`);
  }

  const bundle = options.bundle ?? await fetchExportBundle(options);
  const manifest = await readManifest(cwd);
  const now = options.now ?? new Date().toISOString();
  const backupRoot = path.join(cwd, ".careercenter", "backups", timestampForPath(now));
  const plans = [];
  const rejected = [];
  const conflicts = [];

  for (const file of bundle.files ?? []) {
    const resolved = resolveProjectFile(cwd, file.path);
    if (!resolved.ok) {
      rejected.push({ path: file.path, message: resolved.message });
      continue;
    }

    const strategy = normalizeWriteStrategy(file.writeStrategy);
    const plan = await planFileSync({
      cwd,
      file: { ...file, path: resolved.projectPath, writeStrategy: strategy },
      absolutePath: resolved.absolutePath,
      manifest,
      force: options.force === true
    });
    plans.push(plan);
    if (plan.action === "conflict") {
      conflicts.push({ path: plan.path, message: plan.message ?? "Konflikt." });
    }
  }

  if (options.yes === true && conflicts.length === 0 && rejected.length === 0) {
    await applyPlans({ cwd, plans, manifest, backupRoot, backup: options.backup !== false, now });
  }

  return {
    target,
    cwd,
    dryRun: options.yes !== true,
    manifestPath: path.join(cwd, ".careercenter", "ai-sync.json"),
    backupRoot: options.backup === false ? null : backupRoot,
    files: plans.map(({ absolutePath: _absolutePath, nextContent: _nextContent, existingContent: _existingContent, ...plan }) => plan),
    conflicts,
    rejected
  };
}

export function parseArgs(argv) {
  const options = {
    apiUrl: "http://127.0.0.1:3000",
    target: "all",
    cwd: process.cwd(),
    yes: false,
    force: false,
    backup: true,
    help: false,
    name: process.env.CAREERCENTER_NAME,
    pin: process.env.CAREERCENTER_PIN
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--yes") {
      options.yes = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--no-backup") {
      options.backup = false;
    } else if (arg === "--api-url") {
      options.apiUrl = requireValue(argv, index += 1, arg);
    } else if (arg === "--target") {
      options.target = requireValue(argv, index += 1, arg);
    } else if (arg === "--cwd") {
      options.cwd = requireValue(argv, index += 1, arg);
    } else if (arg === "--name") {
      options.name = requireValue(argv, index += 1, arg);
    } else if (arg === "--pin") {
      options.pin = requireValue(argv, index += 1, arg);
    } else {
      throw new Error(`Ukjent argument: ${arg}`);
    }
  }

  if (!VALID_TARGETS.has(options.target)) {
    throw new Error(`--target ma vaere cursor, codex eller all.`);
  }

  return options;
}

async function fetchExportBundle(options) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("Denne Node-versjonen mangler fetch. Bruk Node 18 eller nyere.");
  }

  const apiUrl = options.apiUrl ?? "http://127.0.0.1:3000";
  const target = options.target ?? "all";
  const cookie = await login({ apiUrl, name: options.name, pin: options.pin, fetchFn });
  const exportUrl = new URL(`/api/education/ai-resources/export?target=${encodeURIComponent(target)}`, apiUrl);
  const response = await fetchFn(exportUrl, {
    method: "GET",
    headers: cookie ? { cookie } : undefined
  });
  if (!response.ok) {
    throw new Error(`Klarte ikke aa hente eksport (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function login({ apiUrl, name, pin, fetchFn }) {
  if (!name || !pin) {
    throw new Error("CAREERCENTER_NAME og CAREERCENTER_PIN maa settes, eller oppgis via prompt.");
  }

  const response = await fetchFn(new URL("/api/auth/login", apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, pin })
  });
  if (!response.ok) {
    throw new Error(`Innlogging feilet (${response.status}): ${await response.text()}`);
  }

  return extractCookie(response.headers.get("set-cookie"));
}

async function resolveCredentials(options, io) {
  if (options.name && options.pin) {
    return { name: options.name, pin: options.pin };
  }

  const input = io.stdin ?? process.stdin;
  const output = io.stdout ?? process.stdout;
  const rl = createInterface({ input, output });
  try {
    const name = options.name || await rl.question("CareerCenter navn: ");
    const pin = options.pin || await rl.question("CareerCenter PIN: ");
    return { name, pin };
  } finally {
    rl.close();
  }
}

async function planFileSync({ cwd, file, absolutePath, manifest, force }) {
  const existingContent = await readTextIfExists(absolutePath);
  const base = {
    path: file.path,
    writeStrategy: file.writeStrategy,
    resourceIds: file.resourceIds ?? [],
    resourceNames: file.resourceNames ?? [],
    absolutePath,
    existingContent,
    nextContent: existingContent,
    ownedMcpServers: []
  };

  if (file.writeStrategy === "replace") {
    return planReplace(base, file, manifest, force);
  }
  if (file.writeStrategy === "managed_markdown_block") {
    return planManagedBlock(base, file, MARKDOWN_BEGIN, MARKDOWN_END);
  }
  if (file.writeStrategy === "toml_managed_block") {
    return {
      ...planManagedBlock(base, file, TOML_BEGIN, TOML_END),
      ownedMcpServers: extractTomlMcpServerNames(file.content)
    };
  }
  if (file.writeStrategy === "json_mcp_merge") {
    return planJsonMcpMerge(base, file, manifest, force);
  }

  return {
    ...base,
    action: "conflict",
    message: `Ukjent writeStrategy: ${file.writeStrategy}`,
    cwd
  };
}

function planReplace(base, file, manifest, force) {
  const nextContent = ensureTrailingNewline(file.content ?? "");
  const existingContent = base.existingContent;
  if (existingContent === null) {
    return { ...base, nextContent, action: "create" };
  }
  if (existingContent === nextContent) {
    return { ...base, nextContent, action: "noop" };
  }

  const manifestEntry = manifest.files?.[file.path];
  const owned = manifestEntry?.hash === sha256(existingContent);
  if (!owned && !force) {
    return {
      ...base,
      nextContent,
      action: "conflict",
      message: "Eksisterende fil er ikke eid av CareerCenter. Bruk --force for aa overskrive."
    };
  }

  return { ...base, nextContent, action: "update" };
}

function planManagedBlock(base, file, begin, end) {
  const existingContent = base.existingContent ?? "";
  const block = `${begin}\n${file.content.trimEnd()}\n${end}\n`;
  const nextContent = upsertManagedBlock(existingContent, block, begin, end);
  const action = base.existingContent === null ? "create" : existingContent === nextContent ? "noop" : "update";
  return { ...base, nextContent, action };
}

function planJsonMcpMerge(base, file, manifest, force) {
  let desired;
  try {
    desired = parseJsonObject(file.content, "Eksportert MCP JSON er ugyldig.");
  } catch (error) {
    return { ...base, action: "conflict", message: error instanceof Error ? error.message : String(error) };
  }
  if (!isRecord(desired.mcpServers)) {
    return { ...base, action: "conflict", message: "Eksportert MCP JSON mangler mcpServers." };
  }

  let existing;
  try {
    existing = base.existingContent === null
      ? {}
      : parseJsonObject(base.existingContent, "Eksisterende MCP JSON er ugyldig.");
  } catch (error) {
    return { ...base, action: "conflict", message: error instanceof Error ? error.message : String(error) };
  }
  if (!isRecord(existing)) {
    return { ...base, action: "conflict", message: "Eksisterende MCP JSON maa vaere et objekt." };
  }
  const existingServers = isRecord(existing.mcpServers) ? { ...existing.mcpServers } : {};
  const desiredServers = desired.mcpServers;
  const ownedServers = new Set(manifest.ownedMcpServers?.[file.path] ?? []);

  for (const name of ownedServers) {
    if (!(name in desiredServers)) {
      delete existingServers[name];
    }
  }

  for (const [name, config] of Object.entries(desiredServers)) {
    const hasExisting = Object.prototype.hasOwnProperty.call(existingServers, name);
    const unchanged = hasExisting && stableJson(existingServers[name]) === stableJson(config);
    if (hasExisting && !unchanged && !ownedServers.has(name) && !force) {
      return {
        ...base,
        action: "conflict",
        message: `MCP-serveren "${name}" finnes fra for og er ikke eid av CareerCenter.`
      };
    }
    existingServers[name] = config;
  }

  const nextObject = { ...existing, mcpServers: sortRecord(existingServers) };
  const nextContent = `${JSON.stringify(nextObject, null, 2)}\n`;
  const action = base.existingContent === null ? "create" : base.existingContent === nextContent ? "noop" : "update";
  return {
    ...base,
    nextContent,
    action,
    ownedMcpServers: Object.keys(desiredServers).sort((a, b) => a.localeCompare(b))
  };
}

async function applyPlans({ cwd, plans, manifest, backupRoot, backup, now }) {
  const nextManifest = {
    version: 1,
    syncedAt: now,
    files: { ...(manifest.files ?? {}) },
    ownedMcpServers: { ...(manifest.ownedMcpServers ?? {}) }
  };

  for (const plan of plans) {
    if (plan.action === "noop") {
      nextManifest.files[plan.path] = manifestEntry(plan, plan.existingContent ?? "");
      updateOwnedMcpServers(nextManifest, plan);
      continue;
    }
    if (plan.action !== "create" && plan.action !== "update") continue;

    if (backup && plan.existingContent !== null) {
      await backupExistingFile(cwd, backupRoot, plan.path, plan.absolutePath);
    }
    await mkdir(path.dirname(plan.absolutePath), { recursive: true });
    await writeFile(plan.absolutePath, plan.nextContent, "utf8");
    nextManifest.files[plan.path] = manifestEntry(plan, plan.nextContent);
    updateOwnedMcpServers(nextManifest, plan);
  }

  const manifestPath = path.join(cwd, ".careercenter", "ai-sync.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
}

function manifestEntry(plan, content) {
  return {
    hash: sha256(content),
    resourceIds: plan.resourceIds,
    resourceNames: plan.resourceNames,
    writeStrategy: plan.writeStrategy
  };
}

function updateOwnedMcpServers(manifest, plan) {
  if (plan.ownedMcpServers.length) {
    manifest.ownedMcpServers[plan.path] = plan.ownedMcpServers;
  }
}

async function backupExistingFile(cwd, backupRoot, projectPath, absolutePath) {
  const target = path.join(backupRoot, ...projectPath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(absolutePath, target);
}

async function readManifest(cwd) {
  const manifestPath = path.join(cwd, ".careercenter", "ai-sync.json");
  const content = await readTextIfExists(manifestPath);
  if (!content) return { version: 1, files: {}, ownedMcpServers: {} };
  try {
    const parsed = JSON.parse(content);
    return {
      version: 1,
      files: isRecord(parsed.files) ? parsed.files : {},
      ownedMcpServers: isRecord(parsed.ownedMcpServers) ? parsed.ownedMcpServers : {}
    };
  } catch {
    throw new Error(`${manifestPath} er ikke gyldig JSON.`);
  }
}

function resolveProjectFile(cwd, rawPath) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return { ok: false, message: "Mangler path." };
  }
  const normalized = rawPath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    return { ok: false, message: "Absolute paths er ikke tillatt." };
  }

  const segments = normalized.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    return { ok: false, message: "Path traversal er ikke tillatt." };
  }

  const absolutePath = path.resolve(cwd, ...segments);
  if (!isInsidePath(cwd, absolutePath)) {
    return { ok: false, message: "Path maa holde seg innen --cwd." };
  }

  return { ok: true, projectPath: segments.join("/"), absolutePath };
}

function normalizeWriteStrategy(strategy) {
  return VALID_WRITE_STRATEGIES.has(strategy) ? strategy : "replace";
}

async function readTextIfExists(filePath) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;
    return readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function upsertManagedBlock(existingContent, block, begin, end) {
  const escapedBegin = escapeRegExp(begin);
  const escapedEnd = escapeRegExp(end);
  const pattern = new RegExp(`${escapedBegin}[\\s\\S]*?${escapedEnd}\\n?`);
  if (pattern.test(existingContent)) {
    return existingContent.replace(pattern, block);
  }
  if (!existingContent.trim()) return block;
  return `${existingContent.trimEnd()}\n\n${block}`;
}

function parseJsonObject(content, message) {
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed)) throw new Error(message);
    return parsed;
  } catch {
    throw new Error(message);
  }
}

function extractTomlMcpServerNames(content) {
  const names = [];
  const pattern = /^\s*\[mcp_servers(?:\.([A-Za-z0-9_-]+)|\."([^"]+)")\]\s*$/gm;
  for (const match of content.matchAll(pattern)) {
    names.push(match[1] ?? match[2]);
  }
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

function extractCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

function requireValue(argv, index, name) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} mangler verdi.`);
  }
  return value;
}

function helpText() {
  return [
    "CareerCenter AI resource sync",
    "",
    "Usage:",
    "  node scripts/ai-resource-sync.mjs --api-url http://127.0.0.1:3000 --target all --cwd . --yes",
    "",
    "Options:",
    "  --target cursor|codex|all",
    "  --cwd <path>",
    "  --yes          Skriv filer. Uten denne kjorer scriptet dry-run.",
    "  --force        Overskriv konflikter for replace/MCP-navn.",
    "  --no-backup    Ikke ta backup av eksisterende filer for endring.",
    "  --name <name>  CareerCenter-bruker. Kan ogsaa settes med CAREERCENTER_NAME.",
    "  --pin <pin>    CareerCenter PIN. Kan ogsaa settes med CAREERCENTER_PIN.",
    ""
  ].join(os.EOL);
}

function formatSummary(result) {
  const lines = [
    `CareerCenter AI sync (${result.dryRun ? "dry-run" : "applied"})`,
    `Target: ${result.target}`,
    `CWD: ${result.cwd}`,
    ""
  ];

  for (const file of result.files) {
    lines.push(`${file.action.toUpperCase()} ${file.path} [${file.writeStrategy}]`);
    if (file.message) lines.push(`  ${file.message}`);
  }
  for (const item of result.rejected) {
    lines.push(`REJECTED ${item.path}: ${item.message}`);
  }
  for (const item of result.conflicts) {
    lines.push(`CONFLICT ${item.path}: ${item.message}`);
  }
  if (!result.files.length && !result.rejected.length) lines.push("Ingen filer i eksporten.");
  if (result.dryRun) lines.push("", "Kjor med --yes for a skrive endringene.");
  return `${lines.join(os.EOL)}${os.EOL}`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function stableJson(value) {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isRecord(value)) return value;
  return sortRecord(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sortDeep(item)])));
}

function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function ensureTrailingNewline(content) {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function isInsidePath(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function timestampForPath(value) {
  return value.replace(/[:.]/g, "-");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (executedPath && existsSync(executedPath) && executedPath === modulePath) {
  runCli().then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}${os.EOL}`);
    process.exitCode = 1;
  });
}
