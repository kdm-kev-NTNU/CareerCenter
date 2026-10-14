import { z } from "zod";
import type { CaseChunk } from "./caseSpans.js";

export const importChunkStatus = ["pending", "done", "failed"] as const;

const chunkSchema = z.object({
  index: z.number().int().nonnegative(),
  fileName: z.string().default(""),
  title: z.string(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  uncertain: z.boolean(),
  status: z.enum(importChunkStatus),
  error: z.string().optional()
});

const jobStateSchema = z.object({
  version: z.literal(2),
  chunks: z.array(chunkSchema)
});

export type ImportChunkState = z.infer<typeof chunkSchema>;
export type ImportJobState = z.infer<typeof jobStateSchema>;

export function chunksFromSpans(spans: CaseChunk[]): ImportChunkState[] {
  return spans.map((span, index) => ({
    index,
    fileName: span.fileName,
    title: span.title,
    pageStart: span.pageStart,
    pageEnd: span.pageEnd,
    uncertain: span.uncertain,
    status: "pending" as const
  }));
}

export function parseImportJobState(resultJson: string): ImportJobState | null {
  try {
    const parsed = jobStateSchema.safeParse(JSON.parse(resultJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeImportJobState(state: ImportJobState): string {
  return JSON.stringify(state);
}

export function chunkProgressMessage(chunks: ImportChunkState[], current: ImportChunkState): string {
  const remaining = chunks.filter((chunk) => chunk.status !== "done").length;
  const uncertain = current.uncertain ? " Usikker grense." : "";
  return `Chunk ${current.index + 1} av ${chunks.length}: ${current.title} (side ${current.pageStart}–${current.pageEnd}). ${remaining} gjenstår.${uncertain}`;
}
