import { defineConfig } from "cypress";
import codeCoverageTask from "@cypress/code-coverage/task.js";

export default defineConfig({
  e2e: {
    baseUrl: "http://127.0.0.1:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(on, config) {
      codeCoverageTask(on, config);
      return config;
    }
  },
  env: {
    codeCoverage: {
      exclude: "cypress/**/*.*"
    }
  },
  video: false
});
