import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      JWT_SECRET: "test-jwt-secret-for-ci-only"
    },
    coverage: {
      provider: "v8",
      reporter: ["json"],
      reportsDirectory: "../coverage/backend",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"]
    }
  }
});
