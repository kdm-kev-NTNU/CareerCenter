import { classifyCaseSource, type CaseSourceKind } from "@careercenter/shared";
import type { LlmClient } from "../ai/llmClient.js";
import { sha256Content } from "./contentHash.js";
import { casebookSegmentSchema, exhibitPromptSchema } from "./knowledgeSchemas.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

const queue: Array<{ userId: string; jobId: string }> = [];
let draining = false;

export function enqueueImportJob(userId: string, jobId: string): void {
  queue.push({ userId, jobId });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    // processed by caller-bound runner via processImportJob
  }
  draining = false;
}

export async function processImportJob(
  deps: { llmClient: LlmClient; repository: InterviewPrepRepository },
  userId: string,
  jobId: string
): Promise<void> {
  const job = await deps.repository.getImportJob(userId, jobId);
  if (!job) return;

  await deps.repository.updateImportJob(userId, jobId, {
    status: "running",
    progress: 10,
    message: "Segmenterer dokument…"
  });

  try {
    const docs = await deps.repository.listKnowledgeDocs(userId);
    const doc = docs.find((d) => d.id === job.knowledgeDocId);
    if (!doc) throw new Error("Kunnskapsdokument ikke funnet.");

    const sourceKind = classifyCaseSource({
      filename: doc.sourceFilename ?? doc.title,
      title: doc.title,
      content: doc.content
    });

    if (sourceKind === "exhibit_pack") {
      await processExhibitPack(deps, userId, jobId, doc.id, doc.title, doc.content, doc.originalFileKey);
      return;
    }

    const segmented = await deps.llmClient.completeStructured(
      {
        messages: [
          {
            role: "system",
            content:
              "Du deler en casebook etter innholdsfortegnelse/struktur. Returner separate cases med prompt, interviewerInfo og solution."
          },
          { role: "user", content: doc.content.slice(0, 120_000) }
        ]
      },
      casebookSegmentSchema
    );

    await deps.repository.updateImportJob(userId, jobId, {
      status: "review",
      progress: 80,
      message: `${segmented.cases.length} cases klare for gjennomgang`,
      resultJson: JSON.stringify(segmented.cases)
    });

    let index = 0;
    for (const item of segmented.cases) {
      const contentHash = sha256Content(`${item.title}:${item.prompt}:${item.solution}:${index}`);
      const existing = await deps.repository.findCaseByHash(userId, contentHash);
      if (!existing) {
        await deps.repository.createCaseEntry(userId, {
          title: item.title,
          prompt: item.prompt,
          interviewerInfo: item.interviewerInfo,
          solution: item.solution,
          sourceKind: "casebook" satisfies CaseSourceKind,
          companyTags: [],
          knowledgeDocId: doc.id,
          contentHash,
          approvalStatus: "pending",
          originalFileKey: doc.originalFileKey
        });
      }
      index += 1;
    }

    await deps.repository.updateImportJob(userId, jobId, {
      status: "done",
      progress: 100,
      message: "Ferdig"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Importjobb feilet.";
    await deps.repository.updateImportJob(userId, jobId, {
      status: "failed",
      progress: 100,
      message
    });
  }
}

async function processExhibitPack(
  deps: { llmClient: LlmClient; repository: InterviewPrepRepository },
  userId: string,
  jobId: string,
  knowledgeDocId: string,
  title: string,
  content: string,
  originalFileKey?: string
): Promise<void> {
  const generated = await deps.llmClient.completeStructured(
    {
      messages: [
        {
          role: "system",
          content: "Lag en case-prompt basert på exhibit-pakken. Marker at prompten må godkjennes."
        },
        { role: "user", content: content.slice(0, 40_000) }
      ]
    },
    exhibitPromptSchema
  );

  const contentHash = sha256Content(`${generated.title}:${generated.prompt}:exhibit`);
  const existing = await deps.repository.findCaseByHash(userId, contentHash);
  if (!existing) {
    await deps.repository.createCaseEntry(userId, {
      title: generated.title || title,
      prompt: generated.prompt,
      interviewerInfo: generated.interviewerInfo,
      solution: generated.solution,
      sourceKind: "exhibit_pack",
      companyTags: [],
      knowledgeDocId,
      contentHash,
      approvalStatus: "pending",
      originalFileKey
    });
  }

  await deps.repository.updateImportJob(userId, jobId, {
    status: "review",
    progress: 100,
    message: "Exhibit-prompt venter på godkjenning",
    resultJson: JSON.stringify([generated])
  });
}
