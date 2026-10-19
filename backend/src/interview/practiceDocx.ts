import { questionCategoryLabels } from "@careercenter/shared";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle
} from "docx";

/** Minimal plan shape needed to render the practice document. */
export interface PracticeDocxPlan {
  companyName: string;
  roleTitle: string;
  questions: Array<{
    text: string;
    category: string;
    audience: string;
    sortOrder: number;
    included: boolean;
    exampleAnswer: string;
    tips: string[];
  }>;
}

/**
 * Pure projection: curated plan questions → Word (.docx) bytes for offline practice.
 * Only included questions are written. Reverse questions get tips only.
 */
export function renderPracticeDocx(plan: PracticeDocxPlan): Promise<Buffer> {
  const candidate = plan.questions
    .filter((q) => q.audience === "candidate" && q.included)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const reverse = plan.questions
    .filter((q) => q.audience !== "candidate" && q.included)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: `Øvingsdokument – ${plan.companyName}`,
      heading: HeadingLevel.TITLE
    })
  );
  if (plan.roleTitle.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: plan.roleTitle.trim(), italics: true, size: 22 })]
      })
    );
  }
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Skriv dine egne svar under «Ditt svar». Eksempelsvar og tips er støttemateriale — prøv først selv.",
          size: 18,
          color: "555555"
        })
      ],
      spacing: { after: 200 }
    })
  );

  const byCategory = new Map<string, typeof candidate>();
  for (const q of candidate) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  let questionNumber = 1;
  for (const [category, items] of byCategory) {
    const title =
      (questionCategoryLabels as Record<string, string>)[category] ?? category;
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 120 }
      })
    );
    for (const q of items) {
      children.push(...questionBlock(questionNumber++, q));
    }
  }

  if (reverse.length) {
    children.push(
      new Paragraph({
        text: "Spørsmål du stiller dem",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280, after: 80 }
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Ha fem klare, still to eller tre, og minst ett personlig.",
            size: 18,
            color: "555555"
          })
        ],
        spacing: { after: 120 }
      })
    );
    for (const q of reverse) {
      children.push(...reverseQuestionBlock(questionNumber++, q));
    }
  }

  const doc = new Document({
    creator: "CareerCenter",
    title: `Øving – ${plan.companyName}`,
    sections: [{ children }]
  });

  return Packer.toBuffer(doc);
}

export function sanitizePracticeFilename(companyName: string): string {
  const base = companyName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "ovingsdokument"}-oving.docx`;
}

function questionBlock(
  n: number,
  q: PracticeDocxPlan["questions"][number]
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: `${n}. ${q.text}`, bold: true, size: 22 })],
      spacing: { before: 200, after: 80 }
    })
  ];

  if (q.exampleAnswer.trim()) {
    paras.push(labelParagraph("Eksempelsvar"));
    paras.push(
      new Paragraph({
        children: [new TextRun({ text: q.exampleAnswer.trim(), size: 20 })],
        spacing: { after: 60 }
      })
    );
  }

  if (q.tips.length) {
    paras.push(labelParagraph("Tips"));
    for (const tip of q.tips) {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${tip}`, size: 20 })],
          spacing: { after: 20 }
        })
      );
    }
  }

  paras.push(labelParagraph("Ditt svar"));
  paras.push(...blankAnswerLines(4));
  return paras;
}

function reverseQuestionBlock(
  n: number,
  q: PracticeDocxPlan["questions"][number]
): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: `${n}. ${q.text}`, bold: true, size: 22 })],
      spacing: { before: 160, after: 60 }
    })
  ];
  if (q.tips.length) {
    paras.push(labelParagraph("Tips"));
    for (const tip of q.tips) {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${tip}`, size: 20 })],
          spacing: { after: 20 }
        })
      );
    }
  }
  return paras;
}

function labelParagraph(label: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, size: 18, color: "333333" })],
    spacing: { before: 80, after: 40 }
  });
}

function blankAnswerLines(count: number): Paragraph[] {
  return Array.from({ length: count }, () =>
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 }
      },
      spacing: { after: 160 },
      children: [new TextRun({ text: " ", size: 20 })]
    })
  );
}
