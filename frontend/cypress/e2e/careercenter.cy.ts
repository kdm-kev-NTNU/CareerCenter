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

    cy.on("window:confirm", () => true);
    cy.contains("button", "Slett").click();
    cy.contains("h2", "Energy Quant-ruten").should("not.exist");

    cy.reload();
    cy.contains("button", "Custom Paths").click();
    cy.contains("h2", "Energy Quant-ruten").should("not.exist");
  });

  it("loads the career board and shows company nodes", () => {
    cy.visit("/");

    cy.contains("button", "Karriereboard").click();
    cy.get(".board-shell").should("be.visible");
    cy.get(".vue-flow").should("exist");
    cy.contains(".board-palette", "Bedrifter").should("be.visible");
    cy.contains(".board-node", "Statkraft").should("be.visible");
  });

  it("renames a custom path and persists the new name", () => {
    cy.visit("/");

    cy.contains("button", "Custom Paths").click();
    cy.get("input[placeholder*='selskap']").clear().type("Statkraft");
    cy.contains("button", "Legg til").click();
    cy.contains("button", "Lagre custom path").click();
    cy.contains("h2", "Energy Quant-ruten").should("be.visible");

    cy.contains("article.panel", "Energy Quant-ruten").contains("button", "Rediger navn").click();
    cy.contains("article.panel", "Energy Quant-ruten").find(".inline-title").clear().type("Min Energy-rute");
    cy.contains("article.panel", "Energy Quant-ruten").contains("button", "Lagre").click();

    cy.contains("h2", "Min Energy-rute").should("be.visible");

    cy.reload();
    cy.contains("button", "Custom Paths").click();
    cy.contains("h2", "Min Energy-rute").should("be.visible");
  });

  it("adds a note on the career board via pane click", () => {
    const noteText = "Vurderer Statkraft som første steg";

    cy.visit("/");

    cy.contains("button", "Karriereboard").click();
    cy.get(".vue-flow__pane").click(120, 120, { force: true });
    cy.contains("button", "Lag notat her").click();
    cy.get(".board-node-note textarea").type(noteText).blur();
    cy.get(".board-node-note").should("contain", noteText);
  });

  it("renames the active career board and persists the name", () => {
    const renamed = "Mitt hovedkart";

    cy.visit("/");

    cy.contains("button", "Karriereboard").click();
    cy.get('input[placeholder="Brettnavn"]').clear().type(renamed).blur();
    cy.contains("small", "Lagret").should("be.visible");
    cy.get("select option:selected").should("contain", renamed);

    cy.reload();
    cy.contains("button", "Karriereboard").click();
    cy.get("select option:selected").should("contain", renamed);
  });

  it("creates a graduate program with requirements and status", () => {
    cy.visit("/");

    cy.contains("button", "Graduate").click();
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til graduate-program").should("be.visible");

    cy.get('[role="dialog"]').contains("label", "Bedrift").parent().find("select").select("nbim");
    cy.get('[role="dialog"]').contains("label", "Programnavn").parent().find("input").type("Technology Graduate Programme");
    cy.get('[role="dialog"]').contains("label", "Søknadslenke").parent().find("input").type("https://example.com/graduate");
    cy.get('[role="dialog"]').contains(".requirement-row", "CV").find('input[type="checkbox"]').last().check();
    cy.get('[role="dialog"]').contains("button", "Legg til").click();

    cy.contains("NBIM").should("be.visible");
    cy.contains("Technology Graduate Programme").should("be.visible");
    cy.contains(".listing-row", "NBIM").click();
    cy.contains("a", "Åpne søknad").should("have.attr", "href", "https://example.com/graduate");
  });

  it("creates an internship with requirements and status", () => {
    cy.visit("/");

    cy.contains("button", "Internship").click();
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til internship").should("be.visible");

    cy.get('[role="dialog"]').contains("label", "Bedrift").parent().find("select").select("statkraft");
    cy.get('[role="dialog"]').contains("label", "Stilling / rolle").parent().find("input").type("Technology Summer Intern");
    cy.get('[role="dialog"]').contains("label", "Søknadslenke").parent().find("input").type("https://example.com/intern");
    cy.get('[role="dialog"]').contains("button", "Legg til").click();

    cy.contains("Statkraft").should("be.visible");
    cy.contains("Technology Summer Intern").should("be.visible");
    cy.contains(".listing-row", "Statkraft").click();
    cy.contains("a", "Åpne søknad").should("have.attr", "href", "https://example.com/intern");
  });

  it("adds and removes a self-study course under education", () => {
    cy.visit("/");

    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Kurs").click();
    cy.contains("h1", "Kurs").should("be.visible");

    cy.contains("label", "Tittel").parent().find("input").type("FastAPI for Beginners");
    cy.contains("label", "Leverandør").parent().find("input").type("YouTube");
    cy.contains("button", "Legg til kurs").click();

    cy.contains("FastAPI for Beginners").should("be.visible");
    cy.contains("YouTube").should("be.visible");

    cy.contains(".course-card", "FastAPI for Beginners").find('button[aria-label="Slett kurs"]').click();
    cy.contains("FastAPI for Beginners").should("not.exist");

    cy.reload();
    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Kurs").click();
    cy.contains("FastAPI for Beginners").should("not.exist");
  });

  it("allows editing and resetting a career track label", () => {
    const editedLabel = "Energy & Quant (redigert)";

    cy.visit("/");

    cy.contains("button", "Karriereboard").click();
    cy.get(".board-palette-tracks").click();
    cy.contains(".track-row", "ENERGY_QUANT").contains("button", "Rediger").click();
    cy.contains(".track-row.editing", "ENERGY_QUANT").find(".inline-title").clear().type(editedLabel);
    cy.contains(".track-row.editing", "ENERGY_QUANT").contains("button", "Lagre").click();

    cy.contains(".track-row", editedLabel).should("be.visible");

    cy.contains(".track-row", "ENERGY_QUANT").contains("button", "Rediger").click();
    cy.contains(".track-row.editing", "ENERGY_QUANT").contains("button", "Tilbakestill").click();

    cy.contains(".track-row", "Energy, Power Trading & Quant").should("be.visible");
    cy.contains(".track-row", editedLabel).should("not.exist");
  });

  it("adds a company and finds it via search", () => {
    const companyName = `E2EBedrift ${Date.now()}`;
    const userName = `e2e-user-${Date.now()}`;

    cy.visit("/login");
    cy.contains("button", "Ny bruker").click();
    cy.get('input[placeholder="Ditt navn"]').type(userName);
    cy.get('input[placeholder="••••"]').type("1234");
    cy.get("form.auth-form button.primary").click();
    cy.url().should("include", "/");

    cy.visit("/companies");
    cy.contains("h1", "Bedriftsbase").should("be.visible");

    cy.contains("button", "+ Legg til").click();
    cy.get(".modal-panel").should("be.visible");
    cy.contains("#modal-title", "Legg til bedrift").should("be.visible");

    cy.get(".modal-body input[placeholder='Bedriftsnavn']").type(companyName);
    cy.get(".modal-body textarea[placeholder*='bedriften']").type("E2E-testbedrift");
    cy.get(".modal-body input[placeholder='Oslo / Norge']").type("Oslo");
    cy.get(".modal-body input[placeholder='Data Scientist']").type("Analytiker");
    cy.get(".role-type-input button").click();
    cy.contains(".modal-footer button", "Legg til bedrift").click();

    cy.contains(".company-card", companyName).should("be.visible");

    cy.get("input[placeholder*='selskap']").clear().type(companyName);
    cy.contains(".company-card", companyName).should("be.visible");
  });
});
