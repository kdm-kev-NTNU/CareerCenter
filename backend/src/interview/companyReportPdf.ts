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

    writeBullets(doc, "Må vite", report.mustKnow, pageWidth);
    writeQuestionPrep(doc, report.questionPrep, pageWidth);
    writeQuestionsToAsk(doc, report.questionsToAsk, pageWidth);
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

function writeQuestionPrep(
  doc: PDFKit.PDFDocument,
  items: CompanyReport["questionPrep"],
  pageWidth: number
): void {
  if (!items.length) return;
  ensureSpace(doc, 28);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Spørsmål du bør kunne svare på", { width: pageWidth });
  doc.moveDown(0.06);
  for (const item of items) {
    ensureSpace(doc, 40);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#222222");
    doc.text(`• ${item.question}`, { width: pageWidth, lineGap: 0 });
    doc.font("Helvetica").text(`  Hvorfor de spør: ${item.whyTheyAsk}`, { width: pageWidth, lineGap: 0 });
    doc.text(`  Svarforslag: ${item.suggestedAnswer}`, { width: pageWidth, lineGap: 0 });
    if (item.backgroundUsed.length) {
      doc.text(`  Fra bakgrunnen: ${item.backgroundUsed.join("; ")}`, { width: pageWidth, lineGap: 0 });
    }
    if (item.companyHooks.length) {
      doc.text(`  Bedriftshooks: ${item.companyHooks.join("; ")}`, { width: pageWidth, lineGap: 0 });
    }
  }
  doc.moveDown(0.25);
}

function writeQuestionsToAsk(
  doc: PDFKit.PDFDocument,
  items: CompanyReport["questionsToAsk"],
  pageWidth: number
): void {
  if (!items.length) return;
  ensureSpace(doc, 28);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  doc.text("Lure spørsmål du kan stille", { width: pageWidth });
  doc.moveDown(0.06);
  doc.font("Helvetica").fontSize(8).fillColor("#222222");
  for (const item of items) {
    ensureSpace(doc, 24);
    doc.font("Helvetica-Bold").text(`• ${item.question}`, { width: pageWidth, lineGap: 0 });
    doc.font("Helvetica").text(`  Hvorfor: ${item.why}`, { width: pageWidth, lineGap: 0 });
  }
  doc.moveDown(0.25);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}
