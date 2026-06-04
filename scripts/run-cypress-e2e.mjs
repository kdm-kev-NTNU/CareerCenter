import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

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

function run(args, env = {}) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32"
  });
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
  children.push(child);
  return child;
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

process.on("exit", stopChildren);
process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

const apiPort = await getFreePort();
const apiUrl = `http://127.0.0.1:${apiPort}`;

run(["run", "dev", "--workspace", "@careercenter/api"], {
  CAREERCENTER_REPOSITORY: "memory",
  JWT_SECRET: "e2e_fixture_only_not_a_real_jwt_secret",
  AUTH_DISABLED: "true",
  PORT: String(apiPort)
});
run(["run", "dev", "--workspace", "@careercenter/web"], {
  CYPRESS_COVERAGE: "true",
  VITE_PROXY_TARGET: apiUrl
});

await waitFor(`${apiUrl}/api/health`);
await waitFor("http://127.0.0.1:5173");

const me = await fetch(`${apiUrl}/api/auth/me`);
if (!me.ok) {
  throw new Error(
    `E2E auth bootstrap failed (${me.status}). Ensure AUTH_DISABLED=true and /api/auth/me works without a session cookie.`
  );
}

const cypressArgs = ["run", "test:e2e", "--workspace", "@careercenter/web"];
if (process.env.CYPRESS_SPEC) {
  cypressArgs.push("--", "--spec", process.env.CYPRESS_SPEC);
}

const cypress = spawn(npmCommand, cypressArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32"
});
cypress.stdout?.pipe(process.stdout);
cypress.stderr?.pipe(process.stderr);

cypress.on("exit", (code) => {
  stopChildren();
  process.exit(code ?? 1);
});
