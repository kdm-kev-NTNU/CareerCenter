import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { extractBankQuestions } from "@careercenter/shared";
import {
  assertBibleCatalog,
  bibleCases,
  bibleDocs,
  ensureInterviewBibleCatalog
} from "./bibleCatalog.js";

interface DocRow {
  id: string;
  userId: string;
  contentHash: string;
  title: string;
  content: string;
}

interface CaseRow {
  id: string;
  userId: string;
  contentHash: string;
  title: string;
}

function uniqueError(): Error {
  const error = new Error("unique");
  (error as Error & { code: string }).code = "P2002";
  return error;
}

function createFakePrisma() {
  const docs: DocRow[] = [];
  const cases: CaseRow[] = [];
  const questions: Array<{ contentHash: string; text: string; origin?: string; sourceText?: string }> = [];
  let docSeq = 0;
  let caseSeq = 0;

  const client = {
    interviewKnowledgeDoc: {
      async count({ where }: { where: { userId: string; contentHash: { in: string[] } } }) {
        return docs.filter((row) => row.userId === where.userId && where.contentHash.in.includes(row.contentHash))
          .length;
      },
      async findMany({ where }: { where: { userId: string; contentHash: { in: string[] } } }) {
        return docs
          .filter((row) => row.userId === where.userId && where.contentHash.in.includes(row.contentHash))
          .map((row) => ({ id: row.id, contentHash: row.contentHash }));
      },
      async findUnique({ where }: { where: { userId_contentHash: { userId: string; contentHash: string } } }) {
        return (
          docs.find(
            (row) =>
              row.userId === where.userId_contentHash.userId &&
              row.contentHash === where.userId_contentHash.contentHash
          ) ?? null
        );
      },
      async create({ data }: { data: DocRow }) {
        if (docs.some((row) => row.userId === data.userId && row.contentHash === data.contentHash)) {
          throw uniqueError();
        }
        const row = { ...data, id: `doc-${docSeq++}` };
        docs.push(row);
        return row;
      }
    },
    interviewCaseEntry: {
      async count({ where }: { where: { userId: string; contentHash: { in: string[] } } }) {
        return cases.filter((row) => row.userId === where.userId && where.contentHash.in.includes(row.contentHash))
          .length;
      },
      async findMany({ where }: { where: { userId: string; contentHash: { in: string[] } } }) {
        return cases
          .filter((row) => row.userId === where.userId && where.contentHash.in.includes(row.contentHash))
          .map((row) => ({ contentHash: row.contentHash }));
      },
      async create({ data }: { data: CaseRow }) {
        if (cases.some((row) => row.userId === data.userId && row.contentHash === data.contentHash)) {
          throw uniqueError();
        }
        const row = { ...data, id: `case-${caseSeq++}` };
        cases.push(row);
        return row;
      }
    },
    interviewBankQuestion: {
      async createMany({
        data
      }: {
        data: Array<{ contentHash: string; text: string; origin?: string; sourceText?: string }>;
      }) {
        for (const item of data) {
          if (!questions.some((row) => row.contentHash === item.contentHash)) questions.push(item);
        }
        return { count: data.length };
      }
    }
  };

  return { client: client as unknown as PrismaClient, docs, cases, questions };
}

describe("interview bible catalog", () => {
  it("has a unique, complete seed", () => {
    assertBibleCatalog();
    expect(bibleDocs.length).toBeGreaterThanOrEqual(16);
    expect(bibleCases.filter((entry) => entry.slug.startsWith("data-"))).toHaveLength(20);
    expect(bibleCases.some((entry) => entry.slug === "kystforsikring-it")).toBe(true);
    const core = bibleDocs.find((doc) => doc.slug === "kjerne");
    expect(core).toBeTruthy();
    expect(extractBankQuestions({ kind: "core", title: core!.title, content: core!.content }).length).toBeGreaterThan(
      10
    );
  });

  it("seeds once and ignores a second pass", async () => {
    const fake = createFakePrisma();
    await ensureInterviewBibleCatalog(fake.client, "user-1");
    const docCount = fake.docs.length;
    const caseCount = fake.cases.length;
    const questionCount = fake.questions.length;
    expect(docCount).toBe(bibleDocs.length);
    expect(caseCount).toBe(bibleCases.length);
    expect(questionCount).toBeGreaterThan(10);
    expect(fake.questions.every((row) => row.origin === "rule" && row.sourceText === row.text)).toBe(true);

    await ensureInterviewBibleCatalog(fake.client, "user-1");
    expect(fake.docs).toHaveLength(docCount);
    expect(fake.cases).toHaveLength(caseCount);
    expect(fake.questions).toHaveLength(questionCount);
  });

  it("survives two parallel seeds for the same user", async () => {
    const fake = createFakePrisma();
    await Promise.all([
      ensureInterviewBibleCatalog(fake.client, "user-2"),
      ensureInterviewBibleCatalog(fake.client, "user-2")
    ]);
    expect(fake.docs).toHaveLength(bibleDocs.length);
    expect(fake.cases).toHaveLength(bibleCases.length);
  });
});
