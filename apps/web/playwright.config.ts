import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "npm run dev --workspace @careercenter/api",
      env: { CAREERCENTER_REPOSITORY: "memory", JWT_SECRET: "e2e-secret", PORT: "3000" },
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "npm run dev --workspace @careercenter/web",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});

