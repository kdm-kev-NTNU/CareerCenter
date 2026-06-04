#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.platform === "win32" ? "node.exe" : "node";
const cursorCommand = process.platform === "win32" ? "cursor.cmd" : "cursor";
const codexCommand = process.platform === "win32" ? "codex.cmd" : "codex";
const testUserName = "__test__";
const testUserPin = "0000";
const children = [];

const options = parseArgs(process.argv.slice(2));
let projectDir = "";

process.on("exit", stopChildren);
process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

try {
  const apiPort = options.apiPort ?? await getFreePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  projectDir = await prepareProjectDir(options.projectDir);
  const keepProject = options.keepProject || options.launchGui || Boolean(options.projectDir);

  log(`Project: ${projectDir}`);
  log(`API: ${apiUrl}`);

  runStreaming("api", npmCommand, ["run", "dev", "--workspace", "@careercenter/api"], {
    CAREERCENTER_REPOSITORY: "memory",
    JWT_SECRET: "e2e_fixture_only_not_a_real_jwt_secret",
    AUTH_DISABLED: "true",
    PORT: String(apiPort)
  });

  await waitFor(`${apiUrl}/api/health`);
  const me = await getJson(`${apiUrl}/api/auth/me`);
  assert(me.name === testUserName, `Expected auth-disabled test user ${testUserName}, got ${me.name ?? "<missing>"}.`);

  await seedAiResources(apiUrl);
  await runCli(apiUrl, projectDir);
  await verifyGeneratedProject(projectDir);

  log("Live CLI sync verified: Cursor rule, Cursor MCP JSON, Codex AGENTS.md block, Codex MCP TOML, and manifest.");

  if (options.launchGui) {
    launchGui(projectDir);
    log("Launched Cursor and Codex Desktop for manual visual confirmation.");
  }

  if (keepProject) {
    log(`Smoke project preserved: ${projectDir}`);
  } else {
    await rm(projectDir, { recursive: true, force: true });
    projectDir = "";
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}${os.EOL}`);
  process.exitCode = 1;
} finally {
  stopChildren();
}

function parseArgs(argv) {
  const parsed = {
    keepProject: false,
    launchGui: false,
    projectDir: "",
    apiPort: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep-project") {
      parsed.keepProject = true;
    } else if (arg === "--launch-gui") {
      parsed.launchGui = true;
    } else if (arg === "--project-dir") {
      parsed.projectDir = requireValue(argv, index += 1, arg);
    } else if (arg === "--api-port") {
      parsed.apiPort = Number(requireValue(argv, index += 1, arg));
      if (!Number.isInteger(parsed.apiPort) || parsed.apiPort < 1 || parsed.apiPort > 65535) {
        throw new Error("--api-port must be a valid TCP port.");
      }
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function helpText() {
  return [
    "CareerCenter AI resource sync live smoke test",
    "",
    "Usage:",
    "  node scripts/ai-resource-sync.live-smoke.mjs [--keep-project] [--launch-gui]",
    "",
    "Options:",
    "  --keep-project          Preserve the generated temp project after verification.",
    "  --launch-gui            Preserve the project and open it in Cursor and Codex Desktop.",
    "  --project-dir <path>    Use a specific empty project directory.",
    "  --api-port <port>       Use a specific API port instead of an auto-selected free port.",
    ""
  ].join(os.EOL);
}

async function prepareProjectDir(requestedDir) {
  if (!requestedDir) {
    return mkdtemp(path.join(os.tmpdir(), "careercenter-ai-sync-smoke-"));
  }

  const resolved = path.resolve(requestedDir);
  await mkdir(resolved, { recursive: true });
  const entries = await readdir(resolved);
  if (entries.length > 0) {
    throw new Error(`--project-dir must point to an empty directory: ${resolved}`);
  }
  return resolved;
}

async function seedAiResources(apiUrl) {
  await postJson(`${apiUrl}/api/education/ai-resources`, {
    name: "Cursor test rule",
    kind: "cursor_rule",
    targetTools: ["cursor"],
    status: "active",
    tags: ["cursor", "rules"],
    installPath: ".cursor/rules/test-rule.mdc",
    content: "# Cursor rule test\nUse the CareerCenter synced rule.",
    frontmatter: { description: "CareerCenter test rule", globs: "**/*.ts", alwaysApply: false },
    configFormat: "mdc",
    notes: ""
  });

  await postJson(`${apiUrl}/api/education/ai-resources`, {
    name: "Codex test instructions",
    kind: "codex_instruction",
    targetTools: ["codex"],
    status: "active",
    tags: ["codex", "instructions"],
    installPath: "AGENTS.md",
    content: "# Codex test\nUse CareerCenter managed instructions.",
    frontmatter: {},
    configFormat: "markdown",
    notes: ""
  });

  await postJson(`${apiUrl}/api/education/ai-resources`, {
    name: "Docs MCP",
    kind: "mcp_server",
    targetTools: ["cursor", "codex"],
    status: "active",
    tags: ["mcp"],
    installPath: "mcp.json",
    content: JSON.stringify({
      mcpServers: {
        docs: {
          command: "npx",
          args: ["docs-mcp"],
          env: { API_KEY: "${API_KEY}" }
        }
      }
    }),
    frontmatter: {},
    configFormat: "json",
    notes: ""
  });
}

async function runCli(apiUrl, cwd) {
  const child = runStreaming("cli", nodeCommand, [
    "scripts/ai-resource-sync.mjs",
    "--api-url", apiUrl,
    "--target", "all",
    "--cwd", cwd,
    "--yes",
    "--name", testUserName,
    "--pin", testUserPin
  ]);
  const exitCode = await waitForChild(child);
  assert(exitCode === 0, `AI resource sync CLI exited with ${exitCode}.`);
}

async function verifyGeneratedProject(cwd) {
  const agents = await readFile(path.join(cwd, "AGENTS.md"), "utf8");
  const cursorRule = await readFile(path.join(cwd, ".cursor", "rules", "test-rule.mdc"), "utf8");
  const cursorMcp = JSON.parse(await readFile(path.join(cwd, ".cursor", "mcp.json"), "utf8"));
  const codexToml = await readFile(path.join(cwd, ".codex", "config.toml"), "utf8");
  const manifest = JSON.parse(await readFile(path.join(cwd, ".careercenter", "ai-sync.json"), "utf8"));

  assert(agents.includes("<!-- BEGIN CAREERCENTER AI RESOURCES -->"), "AGENTS.md is missing the managed block start marker.");
  assert(agents.includes("# Codex test"), "AGENTS.md is missing exported Codex instructions.");
  assert(cursorRule.includes('description: "CareerCenter test rule"'), "Cursor rule is missing MDC frontmatter.");
  assert(cursorRule.includes("# Cursor rule test"), "Cursor rule is missing its body.");
  assert(cursorMcp.mcpServers?.docs?.command === "npx", "Cursor MCP JSON is missing mcpServers.docs.");
  assert(codexToml.includes("# BEGIN CAREERCENTER AI RESOURCES"), "Codex TOML is missing the managed block start marker.");
  assert(codexToml.includes("[mcp_servers.docs]"), "Codex TOML is missing the docs MCP server.");
  assert(manifest.files?.["AGENTS.md"], "Manifest is missing AGENTS.md.");
  assert(manifest.files?.[".cursor/rules/test-rule.mdc"], "Manifest is missing the Cursor rule.");
  assert(manifest.ownedMcpServers?.[".cursor/mcp.json"]?.includes("docs"), "Manifest is missing Cursor MCP ownership.");
  assert(manifest.ownedMcpServers?.[".codex/config.toml"]?.includes("docs"), "Manifest is missing Codex MCP ownership.");
}

function launchGui(cwd) {
  launchDetached(cursorCommand, ["-n", cwd]);
  launchDetached(codexCommand, ["app", cwd]);
}

function launchDetached(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    shell: process.platform === "win32"
  });
  child.unref();
}

function runStreaming(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${url} failed ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function waitFor(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForChild(child) {
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function stopChildren() {
  for (const child of children) {
    if (child.killed || !child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
}

function requireValue(argv, index, name) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function log(message) {
  process.stdout.write(`${message}${os.EOL}`);
}

if (projectDir && existsSync(projectDir) && process.exitCode) {
  log(`Failed smoke project retained for inspection: ${projectDir}`);
}
