import type { CompanyReport } from "@careercenter/shared";
import PDFDocument from "pdfkit";

export interface CompanyReportPdfMeta {
  companyName: string;
  roleTitle: string;
  generatedAt: string;
}

/**
 * Pure projection: structured report JSON → PDF bytes.
 * No I/O beyond building an in-memory buffer.
 */
export function renderCompanyReportPdf(
  report: CompanyReport,
  meta: CompanyReportPdfMeta
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 36, left: 42, right: 42 },
      info: {
        Title: `Bedriftsrapport – ${meta.companyName}`,
        Author: "CareerCenter"
      }
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
    doc.text(report.headline || `Bedriftsrapport: ${meta.companyName}`, {
      width: pageWidth,
      align: "left"
    });
    doc.moveDown(0.15);

    doc.font("Helvetica").fontSize(8).fillColor("#444444");
    const subtitle = [meta.companyName, meta.roleTitle.trim() || null, formatDate(meta.generatedAt)]
      .filter(Boolean)
      .join(" · ");
    doc.text(subtitle, { width: pageWidth });
    doc.moveDown(0.3);

    writeKeyFacts(doc, report, pageWidth);

    writeSection(doc, "Om selskapet", report.aboutCompany, pageWidth);
    writeBullets(doc, "Forretningsområder", report.businessAreas, pageWidth);
    writeBullets(doc, "Strategi og nyheter", report.strategyAndNews, pageWidth);
    writeBullets(doc, "Kultur og verdier", report.cultureAndValues, pageWidth);
    writeSection(doc, "Rollen i kontekst", report.roleInContext, pageWidth);
    writeRequirements(doc, report.jobAdRequirements, pageWidth);
    writeBullets(doc, "Nisje-info til bedriftsspesifikke svar", report.nicheInsights, pageWidth);
    writeCompanyQuestionPrep(doc, report.companyQuestionPrep, pageWidth);
    writeBullets(doc, "Intervju-vinkler", report.interviewAngles, pageWidth);
    writeBullets(doc, "Spørsmål du kan stille", report.questionsToAsk, pageWidth);
    writeBullets(doc, "Kilder", report.sources, pageWidth);

    doc.end();
  });
}

export function sanitizeReportFilename(companyName: string): string {
  const base = companyName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "bedrift"}-bedriftsrapport.pdf`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nb-NO", { year: "numeric", month: "short", day: "numeric" });
}

function writeKeyFacts(
  doc: PDFKit.PDFDocument,
  report: CompanyReport,
  pageWidth: number
): void {
  const facts = [
    report.keyFacts.industry ? `Bransje: ${report.keyFacts.industry}` : null,
    report.keyFacts.headquarters ? `Hovedkontor: ${report.keyFacts.headquarters}` : null,
    report.keyFacts.size ? `Størrelse: ${report.keyFacts.size}` : null,
    report.keyFacts.ownership ? `Eierskap: ${report.keyFacts.ownership}` : null
  ].filter((v): v is string => Boolean(v));

  if (facts.length === 0) return;

  ensureSpace(doc, 40);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Nøkkelfakta", { width: pageWidth });
  doc.moveDown(0.08);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  doc.text(facts.map((f) => `• ${f}`).join("  "), { width: pageWidth, lineGap: 0 });
  doc.moveDown(0.25);
}

function writeSection(
  doc: PDFKit.PDFDocument,
  title: string,
  body: string,
  pageWidth: number
): void {
  const text = body.trim();
  if (!text) return;
  ensureSpace(doc, 32);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text(title, { width: pageWidth });
  doc.moveDown(0.06);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  doc.text(text, { width: pageWidth, align: "left", lineGap: 0 });
  doc.moveDown(0.25);
}

function writeBullets(
  doc: PDFKit.PDFDocument,
  title: string,
  items: string[],
  pageWidth: number
): void {
  const cleaned = items.map((i) => i.trim()).filter(Boolean);
  if (cleaned.length === 0) return;
  ensureSpace(doc, 28);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text(title, { width: pageWidth });
  doc.moveDown(0.06);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  for (const item of cleaned) {
    ensureSpace(doc, 18);
    doc.text(`• ${item}`, { width: pageWidth, lineGap: 0 });
  }
  doc.moveDown(0.25);
}

function writeRequirements(
  doc: PDFKit.PDFDocument,
  requirements: CompanyReport["jobAdRequirements"],
  pageWidth: number
): void {
  if (!requirements.length) return;
  ensureSpace(doc, 28);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Krav fra annonsen – hvordan vise fit", { width: pageWidth });
  doc.moveDown(0.06);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  for (const item of requirements) {
    ensureSpace(doc, 24);
    doc.font("Helvetica-Bold").text(`• ${item.requirement}`, { width: pageWidth, lineGap: 0 });
    doc.font("Helvetica").text(`  → ${item.howToShowFit}`, { width: pageWidth, lineGap: 0 });
  }
  doc.moveDown(0.25);
}

function writeCompanyQuestionPrep(
  doc: PDFKit.PDFDocument,
  items: CompanyReport["companyQuestionPrep"],
  pageWidth: number
): void {
  if (!items.length) return;
  ensureSpace(doc, 28);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Svarforslag – bedriftsspesifikke spørsmål", { width: pageWidth });
  doc.moveDown(0.06);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  for (const item of items) {
    ensureSpace(doc, 28);
    doc.font("Helvetica-Bold").text(`• ${item.question}`, { width: pageWidth, lineGap: 0 });
    doc.font("Helvetica").text(`  Svarvinkel: ${item.answerAngle}`, { width: pageWidth, lineGap: 0 });
    if (item.nicheHooks.length) {
      doc.text(`  Hooks: ${item.nicheHooks.join("; ")}`, { width: pageWidth, lineGap: 0 });
    }
  }
  doc.moveDown(0.25);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}
