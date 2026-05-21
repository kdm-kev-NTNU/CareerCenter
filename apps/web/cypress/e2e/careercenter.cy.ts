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
    const editedTitle = "Spor A nivå 1: Norge, 0-3 år (redigert)";

    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.get('[data-node-id="energy-1"]').find(".map-edit").click();
    cy.get('[data-node-id="energy-1"]').find(".inline-title").clear().type(editedTitle);
    cy.get('[data-node-id="energy-1"]').find(".editable-items input").eq(0).clear().type("Statkraft");
    cy.get('[data-node-id="energy-1"]').find(".editable-items input").eq(1).clear().type("Equinor");
    cy.get('[data-node-id="energy-1"]').find(".editable-items input").eq(2).clear().type("Volue");
    cy.get('[data-node-id="energy-1"]').contains("button", "+ Legg til punkt").click();
    cy.get('[data-node-id="energy-1"]').find(".editable-items input").eq(3).clear().type("Nord Pool");
    cy.get('[data-node-id="energy-1"]').contains("button", "Lagre").click();

    cy.get('[data-node-id="energy-1"]').contains(editedTitle).should("be.visible");
    cy.get('[data-node-id="energy-1"]').contains("Nord Pool").should("be.visible");

    cy.get('[data-node-id="energy-1"]').find(".map-edit").click();
    cy.get('[data-node-id="energy-1"]').contains("button", "Tilbakestill").click();

    cy.get('[data-node-id="energy-1"]').contains("Spor A nivå 1").should("be.visible");
    cy.get('[data-node-id="energy-1"]').contains("(redigert)").should("not.exist");
  });

  it("allows editing and resetting the top career map node", () => {
    const editedTitle = "NÅ: KI-master / Dataingeniør / NTNU (redigert)";

    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.get('[data-node-id="now"]').find(".map-edit").click();
    cy.get('[data-node-id="now"]').find(".inline-title").clear().type(editedTitle);
    cy.get('[data-node-id="now"]').find(".editable-items input").eq(0).clear().type("Tidsserier og forecasting");
    cy.get('[data-node-id="now"]').find(".editable-items input").eq(1).clear().type("RAG / LLM systems / MLOps");
    cy.get('[data-node-id="now"]').find(".editable-items input").eq(2).clear().type("Cloud og produksjonssystemer");
    cy.get('[data-node-id="now"]').find(".editable-items .icon").eq(3).click();
    cy.get('[data-node-id="now"]').contains("button", "Lagre").click();

    cy.get('[data-node-id="now"]').contains(editedTitle).should("be.visible");
    cy.get('[data-node-id="now"]').contains("Cloud og produksjonssystemer").should("be.visible");

    cy.get('[data-node-id="now"]').find(".map-edit").click();
    cy.get('[data-node-id="now"]').contains("button", "Tilbakestill").click();

    cy.get('[data-node-id="now"]').contains("NÅ: KI-master").should("be.visible");
    cy.get('[data-node-id="now"]').contains("(redigert)").should("not.exist");
  });

  it("allows editing and resetting a career track label", () => {
    const editedLabel = "Energy & Quant (redigert)";

    cy.visit("/");

    cy.contains("button", "Karrierekart").click();
    cy.contains(".track-row", "ENERGY_QUANT").contains("button", "Rediger").click();
    cy.contains(".track-row.editing", "ENERGY_QUANT").find(".inline-title").clear().type(editedLabel);
    cy.contains(".track-row.editing", "ENERGY_QUANT").contains("button", "Lagre").click();

    cy.contains(".toolbar button", editedLabel).should("be.visible");

    cy.contains(".track-row", "ENERGY_QUANT").contains("button", "Rediger").click();
    cy.contains(".track-row.editing", "ENERGY_QUANT").contains("button", "Tilbakestill").click();

    cy.contains(".toolbar button", "Energy, Power Trading & Quant").should("be.visible");
    cy.contains(".toolbar button", editedLabel).should("not.exist");
  });
});
