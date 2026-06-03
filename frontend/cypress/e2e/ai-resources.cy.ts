describe("AI resources", () => {
  const pin = "1234";
  let userName: string;

  beforeEach(() => {
    userName = `AIResourceE2E${Date.now()}`;
    cy.request("POST", "/api/auth/register", { name: userName, pin });
  });

  it("imports AI resources, exports sync-ready files, and shows the CLI command", () => {
    cy.visit("/education/ai");

    cy.contains("button", "AI-ressurser").should("be.visible");
    cy.contains("Auto-load / Sync").should("be.visible");
    cy.get("[data-test='sync-command']")
      .should("contain", "node scripts/ai-resource-sync.mjs")
      .and("contain", "--target all")
      .and("contain", "--yes");

    cy.contains(".ai-import-panel", "Import").within(() => {
      cy.contains("label", "Filnavn").find("input").clear().type("AGENTS.md");
      cy.contains("label", "Innhold").find("textarea").clear().type("# Codex E2E\nUse CareerCenter resources.", {
        parseSpecialCharSequences: false
      });
      cy.contains("button", "Importer tekst").click();
    });

    cy.contains(".import-result", "1 opprettet").should("be.visible");
    cy.contains(".ai-resource-card", "Codex project instructions").should("be.visible");

    cy.request("POST", "/api/education/ai-resources/import", {
      files: [
        {
          fileName: "mcp.json",
          content: JSON.stringify({
            mcpServers: {
              docs: {
                command: "npx",
                args: ["docs-mcp"],
                env: { API_KEY: "${API_KEY}" }
              }
            }
          })
        }
      ]
    });

    cy.contains(".ai-export-panel", "Eksport").within(() => {
      cy.contains("button", "Bygg eksport").click();
    });

    cy.contains(".export-file", "AGENTS.md").should("contain", "Managed Markdown");
    cy.contains(".export-file", ".codex/config.toml").should("contain", "Managed TOML");
    cy.contains(".export-file", ".cursor/mcp.json").should("contain", "MCP JSON merge");
  });

  it("creates, filters, edits, and deletes AI resources from the UI", () => {
    cy.visit("/education/ai");

    cy.contains("form.ai-resource-form label", "Navn").find("input").type("E2E Prompt");
    cy.contains("form.ai-resource-form label", "Type").find("select").select("prompt_snippet");
    cy.contains("form.ai-resource-form label", "Innhold").find("textarea").type("# Prompt\nBe concise.", {
      parseSpecialCharSequences: false
    });
    cy.contains("form.ai-resource-form button", "Legg til ressurs").click();

    cy.contains(".ai-resource-card", "E2E Prompt").should("be.visible");

    cy.contains(".ai-resource-toolbar label", "Søk").find("input").type("E2E Prompt");
    cy.contains(".ai-resource-card", "E2E Prompt").should("be.visible");
    cy.contains(".ai-resource-toolbar label", "Type").find("select").select("prompt_snippet");
    cy.contains(".ai-resource-card", "E2E Prompt").should("be.visible");

    cy.contains(".ai-resource-card", "E2E Prompt")
      .find("[data-test='edit-resource']")
      .click();
    cy.get("[data-test='edit-resource-form']", { timeout: 10000 }).should("be.visible");
    cy.get("[data-test='edit-resource-form'] label").contains("Navn").find("input").clear().type("E2E Prompt Updated");
    cy.get("[data-test='edit-resource-form']").contains("button", "Lagre").click();

    cy.contains(".ai-resource-card", "E2E Prompt Updated").should("be.visible");

    cy.contains(".ai-resource-card", "E2E Prompt Updated").contains("button", "Slett").click();

    cy.contains(".ai-resource-card", "E2E Prompt Updated").should("not.exist");
  });
});
