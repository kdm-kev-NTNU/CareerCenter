describe("CareerCenter", () => {
  it("creates a graduate program with requirements and status", () => {
    cy.visit("/graduate");
    cy.contains("h1", "Søknader").should("be.visible");

    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til graduate-program").should("be.visible");

    cy.get('[role="dialog"]').contains("label", "Bedriftsnavn").find("input").type("NBIM");
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
    cy.visit("/internships");
    cy.contains("h1", "Søknader").should("be.visible");

    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til internship").should("be.visible");

    cy.get('[role="dialog"]').contains("label", "Bedriftsnavn").find("input").type("Statkraft");
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

  it("creates and deletes a thesis company", () => {
    const companyName = `E2E Thesis Co ${Date.now()}`;

    cy.visit("/");
    cy.contains("button", "Masteroppgave").click();
    cy.contains("h1", "Masteroppgave").should("be.visible");

    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("h2", "Legg til bedrift").should("be.visible");
    cy.get('[role="dialog"]').contains("label", "Bedriftsnavn").find("input").type(companyName);
    cy.get('[role="dialog"]').contains("label", "Tema / område").find("input").type("E2E tema");
    cy.get('[role="dialog"]').contains("button", "Legg til").click();

    cy.contains(".listing-row", companyName).should("be.visible");

    cy.on("window:confirm", () => true);
    cy.contains(".listing-row", companyName).find('button[aria-label="Slett"]').click();
    cy.contains(".listing-row", companyName).should("not.exist");
  });

  it("filters internships by search query", () => {
    cy.visit("/internships");
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("label", "Bedriftsnavn").find("input").type("Statkraft");
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

  it("smoke-tests listing views, filters, and education tabs", () => {
    cy.visit("/");

    cy.contains("button", "Søknader").click();
    cy.get("input[placeholder*='Søk']").type("NBIM");
    cy.contains("button", "+ Legg til").click();
    cy.get('[role="dialog"]').contains("button", "Avbryt").click();

    cy.contains(".listing-toolbar .kind-filter button", "Internship").click();
    cy.get("select").first().select(1);
    cy.contains("button", "Hackathons").click();
    cy.contains("button", "Tidslinje").click();
    cy.get(".timeline").should("exist");
    cy.contains("button", "Liste").click();

    cy.contains("button", "Utdanning").click();
    cy.contains("button", "Oversikt").click();
    cy.contains("button", "Kurs").click();
    cy.contains("button", "Bøker").click();
    cy.contains("button", "Plattformer").click();
    cy.contains("button", "Bachelor-lærdom").click();
  });
});
