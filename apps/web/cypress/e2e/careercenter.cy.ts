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

    cy.get(".editor input").clear().type("Spor A nivå 1: Norge, 0-3 år (redigert)");
    cy.get(".editor textarea")
      .clear()
      .type("Statkraft{enter}Equinor{enter}Volue{enter}Nord Pool");
    cy.contains(".editor button", "Lagre").click();

    cy.contains(".map-node", "Spor A nivå 1: Norge, 0-3 år (redigert)").should("be.visible");
    cy.contains(".map-node", "Nord Pool").should("be.visible");

    cy.contains(".map-node", "Spor A nivå 1: Norge, 0-3 år (redigert)").within(() => {
      cy.contains("button", "Rediger").click();
    });
    cy.contains(".editor button", "Tilbakestill").click();

    cy.contains(".map-node", "Spor A nivå 1").should("be.visible");
    cy.contains(".map-node", "(redigert)").should("not.exist");
  });

  it("allows editing and resetting the top career map node", () => {
    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".map-node.level-0", "NÅ: KI-master").within(() => {
      cy.contains("button", "Rediger").click();
    });

    cy.get(".editor input").clear().type("NÅ: KI-master / Dataingeniør / NTNU (redigert)");
    cy.get(".editor textarea")
      .clear()
      .type("Tidsserier og forecasting{enter}RAG / LLM systems / MLOps{enter}Cloud og produksjonssystemer");
    cy.contains(".editor button", "Lagre").click();

    cy.contains(".map-node.level-0", "NÅ: KI-master / Dataingeniør / NTNU (redigert)").should("be.visible");
    cy.contains(".map-node.level-0", "Cloud og produksjonssystemer").should("be.visible");

    cy.contains(".map-node.level-0", "NÅ: KI-master / Dataingeniør / NTNU (redigert)").within(() => {
      cy.contains("button", "Rediger").click();
    });
    cy.contains(".editor button", "Tilbakestill").click();

    cy.contains(".map-node.level-0", "NÅ: KI-master").should("be.visible");
    cy.contains(".map-node.level-0", "(redigert)").should("not.exist");
  });

  it("allows editing and resetting a career track label", () => {
    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".track-row", "ENERGY_QUANT").within(() => {
      cy.contains("button", "Rediger").click();
    });

    cy.contains("h2", "Rediger spor-navn")
      .closest("article")
      .within(() => {
        cy.get("input").clear().type("Energy & Quant (redigert)");
        cy.contains("button", "Lagre").click();
      });

    cy.contains(".toolbar button", "Energy & Quant (redigert)").should("be.visible");

    cy.contains(".track-row", "ENERGY_QUANT").within(() => {
      cy.contains("button", "Rediger").click();
    });
    cy.contains("h2", "Rediger spor-navn")
      .closest("article")
      .within(() => {
        cy.contains("button", "Tilbakestill").click();
      });

    cy.contains(".toolbar button", "Energy, Power Trading & Quant").should("be.visible");
    cy.contains(".toolbar button", "Energy & Quant (redigert)").should("not.exist");
  });
});
