import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    env: {
      JWT_SECRET: "test-jwt-secret-for-ci-only-32chars-long"
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
