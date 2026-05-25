import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import istanbul from "vite-plugin-istanbul";

export default defineConfig({
  plugins: [
    vue(),
    istanbul({
      cypress: true,
      requireEnv: true,
      include: "src/**/*.{ts,vue}",
      exclude: ["src/**/*.test.ts"]
    })
  ],
  resolve: {
    alias: {
      "@careercenter/shared": path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
      ignored: ["**/coverage/**"]
    },
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["cypress/**", "playwright.config.ts"],
    coverage: {
      provider: "v8",
      reporter: ["json", "text"],
      reportsDirectory: "../coverage/frontend",
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: ["src/**/*.test.ts", "src/main.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 78
      }
    }
  }
});
