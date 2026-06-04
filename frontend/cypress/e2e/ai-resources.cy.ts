describe("AI resources", () => {
  const pin = "1234";
  let userName: string;

  function openManualWorkbench() {
    cy.contains("summary", "Legg til manuelt").click();
  }

  beforeEach(() => {
    userName = `AIResourceE2E${Date.now()}`;
    cy.request("POST", "/api/auth/register", { name: userName, pin });
  });

  it("returns to AI resources after login from redirect", () => {
    // E2E runs with AUTH_DISABLED on the API, so /api/auth/me always succeeds unless stubbed.
    cy.intercept("GET", "/api/auth/me", {
      statusCode: 401,
      body: { message: "Ikke autentisert." }
    });

    cy.visit("/education/ai");

    cy.location("pathname").should("eq", "/login");
    cy.location("search").should("contain", "redirect=");
    cy.location("search").should("contain", "/education/ai");

    cy.get(".auth-form").contains("label", "Navn").find("input").type(userName);
    cy.get(".auth-form").contains("label", "Pinkode").find("input").type(pin, { log: false });
    cy.get(".auth-form button.primary").click();

    cy.location("pathname").should("eq", "/education/ai");
    cy.contains("h2", "Skann og synk").should("be.visible");
  });

  it("imports AI resources from the manual workbench", () => {
    cy.visit("/education/ai");

    cy.contains("h2", "Skann og synk").should("be.visible");
    cy.contains("[data-test='run-scan']", "Skann prosjekt").should("be.visible");
    cy.contains("[data-test='run-sync']", "Synk til prosjekt").should("be.visible");

    openManualWorkbench();

    cy.contains("h3", "Import fra fil").parent().within(() => {
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

    cy.reload();
    cy.contains(".ai-resource-card", "Codex project instructions").should("be.visible");
    cy.contains(".ai-resource-card", "MCP: docs").should("be.visible");
  });

  it("creates, filters, edits, and deletes AI resources from the UI", () => {
    cy.visit("/education/ai");

    openManualWorkbench();

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
