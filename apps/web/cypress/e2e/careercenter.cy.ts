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
      cy.get(".inline-title").clear().type("Spor A nivå 1: Norge, 0-3 år (redigert)");
      cy.get(".editable-items input").eq(0).clear().type("Statkraft");
      cy.get(".editable-items input").eq(1).clear().type("Equinor");
      cy.get(".editable-items input").eq(2).clear().type("Volue");
      cy.contains("button", "+ Legg til punkt").click();
      cy.get(".editable-items input").eq(3).clear().type("Nord Pool");
      cy.contains("button", "Lagre").click();
    });

    cy.contains(".map-node", "Spor A nivå 1: Norge, 0-3 år (redigert)").should("be.visible");
    cy.contains(".map-node", "Nord Pool").should("be.visible");

    cy.contains(".map-node", "Spor A nivå 1: Norge, 0-3 år (redigert)").within(() => {
      cy.contains("button", "Rediger").click();
      cy.contains("button", "Tilbakestill").click();
    });

    cy.contains(".map-node", "Spor A nivå 1").should("be.visible");
    cy.contains(".map-node", "(redigert)").should("not.exist");
  });

  it("allows editing and resetting the top career map node", () => {
    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".map-node.level-0", "NÅ: KI-master").within(() => {
      cy.contains("button", "Rediger").click();
      cy.get(".inline-title").clear().type("NÅ: KI-master / Dataingeniør / NTNU (redigert)");
      cy.get(".editable-items input").eq(0).clear().type("Tidsserier og forecasting");
      cy.get(".editable-items input").eq(1).clear().type("RAG / LLM systems / MLOps");
      cy.get(".editable-items input").eq(2).clear().type("Cloud og produksjonssystemer");
      cy.get(".editable-items .icon").eq(3).click();
      cy.contains("button", "Lagre").click();
    });

    cy.contains(".map-node.level-0", "NÅ: KI-master / Dataingeniør / NTNU (redigert)").should("be.visible");
    cy.contains(".map-node.level-0", "Cloud og produksjonssystemer").should("be.visible");

    cy.contains(".map-node.level-0", "NÅ: KI-master / Dataingeniør / NTNU (redigert)").within(() => {
      cy.contains("button", "Rediger").click();
      cy.contains("button", "Tilbakestill").click();
    });

    cy.contains(".map-node.level-0", "NÅ: KI-master").should("be.visible");
    cy.contains(".map-node.level-0", "(redigert)").should("not.exist");
  });

  it("allows editing and resetting a career track label", () => {
    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".track-row", "ENERGY_QUANT").within(() => {
      cy.contains("button", "Rediger").click();
      cy.get(".inline-title").clear().type("Energy & Quant (redigert)");
      cy.contains("button", "Lagre").click();
    });

    cy.contains(".toolbar button", "Energy & Quant (redigert)").should("be.visible");

    cy.contains(".track-row", "ENERGY_QUANT").within(() => {
      cy.contains("button", "Rediger").click();
      cy.contains("button", "Tilbakestill").click();
    });

    cy.contains(".toolbar button", "Energy, Power Trading & Quant").should("be.visible");
    cy.contains(".toolbar button", "Energy & Quant (redigert)").should("not.exist");
  });
});
