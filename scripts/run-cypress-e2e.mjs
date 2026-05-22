import { spawn, spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

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

run(["run", "dev", "--workspace", "@careercenter/api"], {
  CAREERCENTER_REPOSITORY: "memory",
  JWT_SECRET: "e2e_fixture_only_not_a_real_jwt_secret",
  AUTH_DISABLED: "true",
  PORT: "3000"
});
run(["run", "dev", "--workspace", "@careercenter/web"], {
  CYPRESS_COVERAGE: "true"
});

await waitFor("http://127.0.0.1:3000/api/health");
await waitFor("http://127.0.0.1:5173");

const cypress = spawn(npmCommand, ["run", "test:e2e", "--workspace", "@careercenter/web"], {
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
