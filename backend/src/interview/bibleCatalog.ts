import {
  caseSourceKinds,
  caseStyles,
  extractBankQuestions,
  knowledgeDocKinds,
  type CaseSourceKind,
  type CaseStyle,
  type KnowledgeDocKind
} from "@careercenter/shared";
import type { PrismaClient } from "@prisma/client";
import { sha256Content } from "./contentHash.js";
import { originalCases, originalDocs } from "./bibleOriginal.js";
import type { BibleCaseSeed, BibleDocSeed } from "./bibleTypes.js";
import { bibleUserDocs } from "./bibleUserDocs.js";
import { dataEngineeringCases } from "./dataEngineeringCases.js";

const CATALOG_VERSION = "v1";

export const bibleDocs: BibleDocSeed[] = [...bibleUserDocs, ...originalDocs];
export const bibleCases: BibleCaseSeed[] = [...dataEngineeringCases, ...originalCases];

const inflight = new Map<string, Promise<void>>();

export function catalogDocHash(slug: string): string {
  return sha256Content(`interview-bible:${CATALOG_VERSION}:doc:${slug}`);
}

export function catalogCaseHash(slug: string): string {
  return sha256Content(`interview-bible:${CATALOG_VERSION}:case:${slug}`);
}

export function assertBibleCatalog(): void {
  const docSlugs = new Set<string>();
  for (const doc of bibleDocs) {
    if (docSlugs.has(doc.slug)) throw new Error(`Duplikat dokument: ${doc.slug}`);
    docSlugs.add(doc.slug);
    if (!isKind(doc.kind)) throw new Error(`Ukjent dokumenttype: ${doc.slug}`);
    if (!doc.title.trim() || !doc.content.trim()) throw new Error(`Tomt dokument: ${doc.slug}`);
  }

  const caseSlugs = new Set<string>();
  for (const entry of bibleCases) {
    if (caseSlugs.has(entry.slug)) throw new Error(`Duplikat case: ${entry.slug}`);
    caseSlugs.add(entry.slug);
    if (!docSlugs.has(entry.docSlug)) throw new Error(`Case ${entry.slug} peker på ukjent dokument.`);
    if (!isCaseSource(entry.sourceKind) || !isCaseStyle(entry.caseStyle)) {
      throw new Error(`Ugyldig case-meta: ${entry.slug}`);
    }
    if (!entry.prompt.trim() || !entry.solution.trim()) throw new Error(`Ufullstendig case: ${entry.slug}`);
  }
}

export async function ensureInterviewBibleCatalog(prisma: PrismaClient, userId: string): Promise<void> {
  const pending = inflight.get(userId);
  if (pending) return pending;
  const run = seedCatalog(prisma, userId).finally(() => {
    inflight.delete(userId);
  });
  inflight.set(userId, run);
  return run;
}

async function seedCatalog(prisma: PrismaClient, userId: string): Promise<void> {
  assertBibleCatalog();
  const docHashes = bibleDocs.map((doc) => catalogDocHash(doc.slug));
  const caseHashes = bibleCases.map((entry) => catalogCaseHash(entry.slug));

  const [docCount, caseCount] = await Promise.all([
    prisma.interviewKnowledgeDoc.count({ where: { userId, contentHash: { in: docHashes } } }),
    prisma.interviewCaseEntry.count({ where: { userId, contentHash: { in: caseHashes } } })
  ]);
  if (docCount === bibleDocs.length && caseCount === bibleCases.length) return;

  const docIdBySlug = new Map<string, string>();
  const existingDocs = await prisma.interviewKnowledgeDoc.findMany({
    where: { userId, contentHash: { in: docHashes } },
    select: { id: true, contentHash: true }
  });
  const docHashToSlug = new Map(bibleDocs.map((doc) => [catalogDocHash(doc.slug), doc.slug]));
  for (const row of existingDocs) {
    const slug = docHashToSlug.get(row.contentHash);
    if (slug) docIdBySlug.set(slug, row.id);
  }

  for (const doc of bibleDocs) {
    if (docIdBySlug.has(doc.slug)) continue;
    const contentHash = catalogDocHash(doc.slug);
    const id = await createDoc(prisma, userId, doc, contentHash);
    docIdBySlug.set(doc.slug, id);
    await indexDocQuestions(prisma, userId, id, doc);
  }

  const existingCases = await prisma.interviewCaseEntry.findMany({
    where: { userId, contentHash: { in: caseHashes } },
    select: { contentHash: true }
  });
  const presentCases = new Set(existingCases.map((row) => row.contentHash));

  for (const entry of bibleCases) {
    const contentHash = catalogCaseHash(entry.slug);
    if (presentCases.has(contentHash)) continue;
    const knowledgeDocId = docIdBySlug.get(entry.docSlug);
    await createCase(prisma, userId, entry, contentHash, knowledgeDocId);
    presentCases.add(contentHash);
  }
}

async function createDoc(
  prisma: PrismaClient,
  userId: string,
  doc: BibleDocSeed,
  contentHash: string
): Promise<string> {
  try {
    const created = await prisma.interviewKnowledgeDoc.create({
      data: {
        userId,
        kind: doc.kind,
        title: doc.title,
        content: doc.content,
        sourceFilename: doc.sourceFilename,
        contentHash
      },
      select: { id: true }
    });
    return created.id;
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await prisma.interviewKnowledgeDoc.findUnique({
      where: { userId_contentHash: { userId, contentHash } },
      select: { id: true }
    });
    if (!existing) throw error;
    return existing.id;
  }
}

async function indexDocQuestions(
  prisma: PrismaClient,
  userId: string,
  knowledgeDocId: string,
  doc: BibleDocSeed
): Promise<void> {
  const extracted = extractBankQuestions({ kind: doc.kind, title: doc.title, content: doc.content });
  if (extracted.length === 0) return;
  await prisma.interviewBankQuestion.createMany({
    data: extracted.map((item) => ({
      userId,
      knowledgeDocId,
      text: item.text,
      category: item.category,
      origin: "rule",
      sourceText: item.text,
      tags: item.tags,
      contentHash: sha256Content(`${CATALOG_VERSION}:${doc.slug}:${item.contentHashInput}`)
    })),
    skipDuplicates: true
  });
}

async function createCase(
  prisma: PrismaClient,
  userId: string,
  entry: BibleCaseSeed,
  contentHash: string,
  knowledgeDocId: string | undefined
): Promise<void> {
  try {
    await prisma.interviewCaseEntry.create({
      data: {
        userId,
        knowledgeDocId,
        title: entry.title,
        prompt: entry.prompt,
        interviewerInfo: entry.interviewerInfo,
        solution: entry.solution,
        sourceKind: entry.sourceKind,
        caseStyle: entry.caseStyle,
        companyTags: entry.companyTags,
        contentHash,
        approvalStatus: "approved"
      }
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isKind(value: string): value is KnowledgeDocKind {
  return (knowledgeDocKinds as readonly string[]).includes(value);
}

function isCaseSource(value: string): value is CaseSourceKind {
  return (caseSourceKinds as readonly string[]).includes(value);
}

function isCaseStyle(value: string): value is CaseStyle {
  return (caseStyles as readonly string[]).includes(value);
}
