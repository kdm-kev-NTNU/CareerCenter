import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "cypress";
import codeCoverageTask from "@cypress/code-coverage/task.js";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..");

async function countSkillFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && /^SKILL\.md$/i.test(entry.name)) {
        count += 1;
      } else if (entry.isDirectory()) {
        count += await countSkillFiles(fullPath);
      }
    }
  } catch {
    return 0;
  }
  return count;
}

export default defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(on, config) {
      codeCoverageTask(on, config);

      on("task", {
        async agentInventoryStatus({ repoRoot: root }: { repoRoot: string }) {
          const skillsDir = path.join(root, ".agent-inventory", "skills");
          const skillCount = await countSkillFiles(skillsDir);
          return { ready: skillCount > 0, skillCount };
        }
      });

      return config;
    }
  },
  env: {
    repoRoot,
    CI: process.env.CI === "true",
    codeCoverage: {
      exclude: "cypress/**/*.*"
    }
  },
  video: false
});
