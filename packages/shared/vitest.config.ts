import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["json"],
      reportsDirectory: "../coverage/packages",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"]
    }
  }
});
