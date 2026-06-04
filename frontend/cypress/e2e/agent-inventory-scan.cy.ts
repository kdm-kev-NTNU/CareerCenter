describe("Agent inventory scan", () => {
  const pin = "1234";
  const repoRoot = Cypress.env("repoRoot") as string;
  let userName: string;
  let expectedSkillCount = 0;

  before(function () {
    cy.task("agentInventoryStatus", { repoRoot }).then((status: { ready: boolean; skillCount: number }) => {
      if (!status.ready) {
        if (Cypress.env("CI")) {
          this.skip();
          return;
        }
        throw new Error("Kjør: powershell -File ./scripts/sync-agent-inventory.ps1");
      }
      expectedSkillCount = status.skillCount;
    });
  });

  beforeEach(() => {
    userName = `AgentInvE2E${Date.now()}`;
    cy.request("POST", "/api/auth/register", { name: userName, pin });
  });

  it("skanner .agent-inventory/skills fra repo-root", () => {
    cy.visit("/education/ai");

    cy.get("[data-test='sync-cwd']").clear().type(repoRoot, { parseSpecialCharSequences: false });
    cy.contains("[data-test='run-scan']", "Skann prosjekt").should("not.be.disabled").click();

    cy.get("[data-test='scan-error']").should("not.exist");
    cy.get("[data-test='scan-result']", { timeout: 120_000 }).should("be.visible");
    cy.get("[data-test='scan-result']")
      .invoke("text")
      .should("match", new RegExp(`Skannet ${expectedSkillCount} filer`));

    cy.contains(".ai-resource-card", /readme-updater|good-ci-cd/i).should("be.visible");
  });

  it("oppdaterer skills ved ny skanning uten duplikater", () => {
    cy.visit("/education/ai");

    cy.get("[data-test='sync-cwd']").clear().type(repoRoot, { parseSpecialCharSequences: false });
    cy.contains("[data-test='run-scan']", "Skann prosjekt").click();
    cy.get("[data-test='scan-result']", { timeout: 120_000 }).should("be.visible");

    cy.contains("[data-test='run-scan']", "Skann prosjekt").click();
    cy.get("[data-test='scan-error']").should("not.exist");
    cy.get("[data-test='scan-result']")
      .invoke("text")
      .should("match", /oppdatert|0 nye/);
  });
});
