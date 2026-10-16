import { access, constants } from "node:fs/promises";
import path from "node:path";
import {
  aonSourcePdfs,
  getAonSourcePdf,
  type AonSourcePdfMeta
} from "@careercenter/shared";

export interface AonSourcePdfListItem extends AonSourcePdfMeta {
  available: boolean;
}

function workspaceRootCandidates(): string[] {
  // Backend usually runs with cwd = backend/; repo root is one level up.
  return [path.resolve(process.cwd(), ".."), process.cwd()];
}

function isSafeCatalogFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    path.basename(filename) === filename
  );
}

async function fileReadable(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve an on-disk path for a catalog id only.
 * Paths are built exclusively from the fixed catalog filename — never from user input.
 */
export async function resolveExistingAonSourcePath(id: string): Promise<{
  meta: AonSourcePdfMeta;
  absolutePath: string;
  available: boolean;
} | null> {
  const meta = getAonSourcePdf(id);
  if (!meta || !isSafeCatalogFilename(meta.filename)) return null;

  for (const root of workspaceRootCandidates()) {
    const absolutePath = path.join(root, "stoff", "aon", meta.filename);
    if (path.basename(absolutePath) !== meta.filename) continue;
    if (await fileReadable(absolutePath)) {
      return { meta, absolutePath, available: true };
    }
  }

  const absolutePath = path.join(workspaceRootCandidates()[0]!, "stoff", "aon", meta.filename);
  return { meta, absolutePath, available: false };
}

export async function listAonSourcePdfs(): Promise<AonSourcePdfListItem[]> {
  const items: AonSourcePdfListItem[] = [];
  for (const meta of aonSourcePdfs) {
    const resolved = await resolveExistingAonSourcePath(meta.id);
    items.push({
      ...meta,
      available: resolved?.available === true
    });
  }
  return items;
}
