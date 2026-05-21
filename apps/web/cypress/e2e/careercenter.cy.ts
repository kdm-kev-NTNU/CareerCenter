describe("CareerCenter custom paths", () => {
  it("creates, displays, deletes, and persists removal of a custom path", () => {
    cy.visit("/");

    cy.contains("h1", "Dashboard").should("be.visible");
    cy.contains("button", "Custom Paths").click();

    cy.get("input[placeholder*='selskap']").clear().type("Statkraft");
    cy.contains("button", "Legg til").click();

    cy.get("input[placeholder*='selskap']").clear().type("InCommodities");
    cy.contains("button", "Legg til").click();

    cy.contains("button", "Lagre custom path").click();
    cy.contains("h2", "Energy Quant-ruten").should("be.visible");
    cy.contains(".path-line.saved", "Statkraft").should("be.visible");
    cy.contains(".path-line.saved", "InCommodities").should("be.visible");

    cy.contains("button", "Slett").click();
    cy.contains("h2", "Energy Quant-ruten").should("not.exist");

    cy.reload();
    cy.contains("button", "Custom Paths").click();
    cy.contains("h2", "Energy Quant-ruten").should("not.exist");
  });

  it("allows editing and resetting a career map node", () => {
    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".map-node", "Spor A nivå 1").within(() => {
      cy.contains("button", "Rediger").click();
    });

    cy.get(".editor input").clear().type("Spor A nivaa 1: Norge, 0-3 ar (redigert)");
    cy.get(".editor textarea")
      .clear()
      .type("Statkraft{enter}Equinor{enter}Volue{enter}Nord Pool");
    cy.contains(".editor button", "Lagre").click();

    cy.contains(".map-node", "Spor A nivaa 1: Norge, 0-3 ar (redigert)").should("be.visible");
    cy.contains(".map-node", "Nord Pool").should("be.visible");

    cy.contains(".map-node", "Spor A nivaa 1: Norge, 0-3 ar (redigert)").within(() => {
      cy.contains("button", "Rediger").click();
    });
    cy.contains(".editor button", "Tilbakestill").click();

    cy.contains(".map-node", "Spor A nivå 1").should("be.visible");
    cy.contains(".map-node", "(redigert)").should("not.exist");
  });
});
