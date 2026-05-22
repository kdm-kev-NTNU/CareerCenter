import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@careercenter/shared": path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../packages/shared/src/index.ts")
    }
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["json"],
      reportsDirectory: "../coverage/backend",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/prismaRepository.ts"]
    }
  }
});
