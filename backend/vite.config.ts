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
      exclude: [
        "src/**/*.test.ts",
        "src/index.ts",
        "src/prismaRepository.ts",
        "src/**/*RepositoryImpl.ts",
        "src/**/graduateProgramCatalog.ts",
        "src/**/internshipCatalog.ts",
        "src/**/graduateProgramCatalogMemory.ts",
        "src/**/internshipCatalogMemory.ts",
        "src/**/*MemoryRepositoryImpl.ts",
        "src/auth/bootstrapUser.ts",
        "src/seedData.ts",
        "src/boardGraphSeed.ts",
        "src/internshipSeedData.ts",
        "src/graduateProgramSeedData.ts",
        "src/bachelorFileStorage.ts",
        "src/memoryRepository.ts"
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70
      }
    }
  }
});
