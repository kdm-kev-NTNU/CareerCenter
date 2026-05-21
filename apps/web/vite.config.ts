import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@careercenter/shared": path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "playwright.config.ts"]
  }
});
