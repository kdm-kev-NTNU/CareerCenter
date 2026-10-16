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
/**
 * Roots are searched in order. The default is the repo root (cwd or its parent).
 * Callers pass an explicit list when availability must not depend on the workspace copy.
 */
export async function resolveExistingAonSourcePath(
  id: string,
  roots: readonly string[] = workspaceRootCandidates()
): Promise<{
  meta: AonSourcePdfMeta;
  absolutePath: string;
  available: boolean;
} | null> {
  const meta = getAonSourcePdf(id);
  if (!meta || !isSafeCatalogFilename(meta.filename)) return null;
  if (roots.length === 0) return null;

  let fallbackPath = "";
  for (const root of roots) {
    const absolutePath = path.join(root, "stoff", "aon", meta.filename);
    if (path.basename(absolutePath) !== meta.filename) continue;
    fallbackPath = absolutePath;
    if (await fileReadable(absolutePath)) {
      return { meta, absolutePath, available: true };
    }
  }

  if (!fallbackPath) return null;
  return { meta, absolutePath: fallbackPath, available: false };
}

export async function listAonSourcePdfs(
  roots: readonly string[] = workspaceRootCandidates()
): Promise<AonSourcePdfListItem[]> {
  const items: AonSourcePdfListItem[] = [];
  for (const meta of aonSourcePdfs) {
    const resolved = await resolveExistingAonSourcePath(meta.id, roots);
    items.push({
      ...meta,
      available: resolved?.available === true
    });
  }
  return items;
}
