import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@careercenter/shared": path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../packages/shared/src/index.ts")
    }
  },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["json"],
      reportsDirectory: "../../coverage/apps/api",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/prismaRepository.ts"]
    }
  }
});
