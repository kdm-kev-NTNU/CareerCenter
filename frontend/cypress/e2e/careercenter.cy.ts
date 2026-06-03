describe("CareerCenter", () => {
  it("promotes a free-text internship company to Bedriftsbase", () => {
    const companyName = `E2EPromote ${Date.now()}`;

    cy.visit("/internships");
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("label", "Bedrift").find("select").select("Annet (fritekst)");
    cy.get('[role="dialog"]').contains("label", "Bedriftsnavn").find("input").type(companyName);
    cy.get('[role="dialog"]').contains("label", "Stilling / rolle").find("input").type("Summer Analyst");
    cy.get('[role="dialog"]').contains("button", "Legg til").click();

    cy.contains(".listing-row", companyName).find('button[aria-label="Legg til i Bedriftsbase"]').click();
    cy.get(".modal-body textarea[placeholder*='bedriften']").type("Promotert fra internship");
    cy.get(".modal-body input[placeholder='Oslo / Norge']").type("Oslo");
    cy.get(".modal-body input[placeholder='Data Scientist']").type("Analyst");
    cy.get(".role-type-input button").click();
    cy.contains(".modal-footer button", "Legg til i Bedriftsbase").click();

    cy.contains(".listing-row", companyName).find('button[aria-label="Legg til i Bedriftsbase"]').should("not.exist");
    cy.contains(".listing-row", companyName).find('[aria-label="I Bedriftsbasen"]').should("be.visible");

    cy.visit("/companies");
    cy.get("input[placeholder*='selskap']").clear().type(companyName);
    cy.contains(".company-card", companyName).should("be.visible");
  });

  it("loads the career board and shows company nodes", () => {
    cy.visit("/");

    cy.contains("button", "Karriereboard").click();
    cy.get(".board-shell").should("be.visible");
    cy.get(".vue-flow").should("exist");
    cy.contains(".board-palette", "Bedrifter").should("be.visible");
    cy.contains(".board-node", "Statkraft").should("be.visible");
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

    cy.get('[role="dialog"]').contains("label", "Bedrift").find("select").select("nbim");
    cy.get('[role="dialog"]').contains("label", "Programnavn").find("input").type("Technology Graduate Programme");
    cy.get('[role="dialog"]').contains("label", "Søknadslenke").find("input").type("https://example.com/graduate");
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

    cy.get('[role="dialog"]').contains("label", "Bedrift").find("select").select("statkraft");
    cy.get('[role="dialog"]').contains("label", "Stilling / rolle").find("input").type("Technology Summer Intern");
    cy.get('[role="dialog"]').contains("label", "Søknadslenke").find("input").type("https://example.com/intern");
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

    cy.contains("label", "Tittel").find("input").type("FastAPI for Beginners");
    cy.contains("label", "Leverandør").find("input").type("YouTube");
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

  it("creates and deletes a competition entry", () => {
    const title = `E2E Hackathon ${Date.now()}`;

    cy.visit("/");
    cy.contains("button", "Hackathons").click();
    cy.contains("h1", "Hackathons & konkurranser").should("be.visible");

    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til arrangement").should("be.visible");
    cy.get('[role="dialog"]').contains("label", "Tittel").find("input").type(title);
    cy.get('[role="dialog"]').contains("label", "Arrangør").find("input").type("E2E Org");
    cy.get('[role="dialog"]').contains("button", "Legg til").click();

    cy.contains(".listing-row", title).should("be.visible");

    cy.on("window:confirm", () => true);
    cy.contains(".listing-row", title).find('button[aria-label="Slett"]').click();
    cy.contains(".listing-row", title).should("not.exist");
  });

  it("filters internships by search query", () => {
    cy.visit("/internships");
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("label", "Bedrift").find("select").select("statkraft");
    cy.get('[role="dialog"]').contains("label", "Stilling / rolle").find("input").type("Filter Intern");
    cy.get('[role="dialog"]').contains("button", "Legg til").click();
    cy.contains(".listing-row", "Filter Intern").should("be.visible");

    cy.get("input[placeholder*='Søk']").type("Filter Intern");
    cy.contains(".listing-row", "Filter Intern").should("be.visible");
    cy.get("input[placeholder*='Søk']").clear().type("ingen-treff-xyz");
    cy.contains(".listing-row", "Filter Intern").should("not.exist");
  });

  it("adds a bachelor folder under education", () => {
    cy.visit("/");
    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Bachelor-lærdom").click();
    cy.contains("h2", "Mapper").should("be.visible");

    cy.get('input[placeholder="Ny mappe"]').type("Algoritmer");
    cy.get("form.folder-create").contains("button", "+").click();
    cy.contains(".folder-tree", "Algoritmer").should("be.visible");
  });

  it("uploads a PDF file to a bachelor folder", () => {
    const folderName = `E2E PDF ${Date.now()}`;

    cy.visit("/");
    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Bachelor-lærdom").click();

    cy.get('input[placeholder="Ny mappe"]').type(folderName);
    cy.get("form.folder-create").contains("button", "+").click();
    cy.contains(".folder-label", folderName).click();

    cy.get('input[type="file"]').selectFile("cypress/fixtures/sample.pdf", { force: true });

    cy.contains(".upload-feedback-ok", "sample.pdf").should("contain", "Lastet opp");
    cy.contains(".file-card strong", "sample.pdf").should("be.visible");
  });

  it("adds a book and platform under education", () => {
    cy.visit("/");
    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Bøker").click();
    cy.contains("h2", "Bøker").should("be.visible");
    cy.contains("label", "Tittel").find("input").type("Clean Code");
    cy.contains("button", "Legg til bok").click();
    cy.contains(".course-card", "Clean Code").should("be.visible");

    cy.contains("button", "Plattformer").click();
    cy.contains("h2", "Online learning platforms").should("be.visible");
    cy.contains("label", "Navn").find("input").type("Udemy");
    cy.contains("button", "Legg til plattform").click();
    cy.contains(".course-card", "Udemy").should("be.visible");
  });

  it("adds a course on the master plan", () => {
    cy.visit("/");
    cy.contains("button", "Master Plan").click();
    cy.contains("label", "Fagkode").find("input").type("TDT4173");
    cy.contains("label", "Tittel").find("input").type("Machine Learning");
    cy.contains("button", "Legg til fag").click();
    cy.contains(".course-card", "TDT4173").should("be.visible");
  });

  it("edits notes on a master plan course", () => {
    const noteText = "Passer energispor";

    cy.visit("/");
    cy.contains("button", "Master Plan").click();
    cy.contains("label", "Fagkode").find("input").type("TDT4999");
    cy.contains("label", "Tittel").find("input").type("E2E Notes Course");
    cy.contains("button", "Legg til fag").click();
    cy.contains(".course-card", "TDT4999").contains("button", "Legg til notater").click();
    cy.get('[role="dialog"]').find("textarea").type(noteText);
    cy.get('[role="dialog"]').contains("button", "Lagre").click();
    cy.contains(".course-card", "TDT4999").should("contain", noteText);
  });

  it("smoke-tests listing views, filters, and education tabs", () => {
    cy.visit("/");

    cy.contains("button", "Graduate").click();
    cy.get("input[placeholder*='Søk']").type("NBIM");
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("button", "Avbryt").click();

    cy.contains("button", "Internship").click();
    cy.get("select").first().select(1);
    cy.contains("button", "Hackathons").click();
    cy.contains("button", "Tidslinje").click();
    cy.get(".timeline").should("exist");
    cy.contains("button", "Liste").click();

    cy.contains("button", "Bedrifter").click();
    cy.get("input[placeholder*='selskap']").type("Stat");

    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Oversikt").click();
    cy.contains("button", "Kurs").click();
    cy.contains("button", "Bøker").click();
    cy.contains("button", "Plattformer").click();
    cy.contains("button", "Bachelor-lærdom").click();

    cy.contains("button", "Karriereboard").click();
    cy.get(".board-shell").should("be.visible");
  });
});
