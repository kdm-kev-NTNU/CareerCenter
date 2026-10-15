import {
  answerStats,
  canDeleteImportJob,
  canStartSimulators,
  categoryForAudience,
  classifyCaseSource,
  DEFAULT_SIMULATOR_LANGUAGE,
  DEFAULT_SIMULATOR_TONE,
  defaultSimulatorSettings,
  defaultVideoSimulatorSettings,
  extractBankQuestions,
  inferKnowledgeKind,
  normalizeEssentialsInput,
  resolveEssentialsSheet,
  starRubricCriteria,
  videoSimulatorSettingsSchema
} from "@careercenter/shared";
import type { QuestionAudience } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import type { LlmClient } from "../ai/llmClient.js";
import { env } from "../config/env.js";
import { toFullCaseDto, toPublicCaseDto } from "../interview/caseDto.js";
import { parseCaseSections } from "../interview/caseSections.js";
import { sha256Content } from "../interview/contentHash.js";
import {
  toBankQuestionDto,
  toImportJobDto,
  toKnowledgeDocDto,
  toMessageDto,
  toPrepPlanDto,
  toSessionDto,
  toSimulatorSettingsDto
} from "../interview/dtoMappers.js";
import { interviewFeedbackRubricSchema, sumRubricScores } from "../interview/feedbackRubric.js";
import { shouldChunkImport } from "../interview/caseSpans.js";
import { importDocumentText } from "../interview/importDocumentText.js";
import {
  buildEssentialsDraftSystemPrompt,
  buildEssentialsDraftUserMessage,
  selectEssentialsSourceDocs
} from "../interview/essentialsDraft.js";
import { cancelImportJob, hasCompletedImportJob } from "../interview/importJobService.js";
import {
  ensureImportJob,
  queueQuestionCleanup,
  shouldQueueQuestionImport,
  queueQuestionImportsForSparseDocs,
  startImportJob
} from "../interview/importJobOrchestration.js";
import { JobCancellationRegistry } from "../interview/jobCancellationRegistry.js";
import { buildInterviewStoragePath, writeInterviewFile } from "../interview/interviewFileStorage.js";
import {
  renderCompanyReportPdf,
  sanitizeReportFilename
} from "../interview/companyReportPdf.js";
import {
  addPlanQuestionSchema,
  bankQuestionQuerySchema,
  caseEntryInputSchema,
  clarificationAnswersSchema,
  companyReportSchema,
  createSessionSchema,
  discardBankQuestionSchema,
  essentialsDraftSchema,
  knowledgeDocInputSchema,
  patchBankQuestionSchema,
  patchPlanQuestionSchema,
  prepPlanIntakeSchema,
  questionCleanupRequestSchema,
  reorderPlanQuestionsSchema,
  replacePlanQuestionSchema,
  sessionMessageSchema,
  simulatorSettingsSchema,
  voiceSessionBodySchema
} from "../interview/knowledgeSchemas.js";
import {
  toAbilityAttemptDto,
  toVideoRunDto,
  toVideoSettingsDto
} from "../interview/meccaMappers.js";
import {
  abilityAttemptInputSchema,
  parseMultipartBool,
  transcriptMessageSchema,
  videoRunInputSchema,
  videoTranscribeFieldsSchema
} from "../interview/meccaSchemas.js";
import { PrepResearchService } from "../interview/prepResearchService.js";
import { reindexAllBankQuestions, reindexBankQuestionsForDoc } from "../interview/reindexBankQuestions.js";
import {
  buildFinishRubricPrompt,
  buildPlanPracticeScript,
  buildSimulatorSystemPrompt,
  formatSessionTranscriptForRubric
} from "../interview/prompts.js";
import { createVoiceSession } from "../interview/voiceSession.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

export interface InterviewPrepRouteDeps {
  llmClient: LlmClient;
  interviewPrepRepository: InterviewPrepRepository;
  jobCancellationRegistry?: JobCancellationRegistry;
}

export async function interviewPrepRoutes(app: FastifyInstance, deps: InterviewPrepRouteDeps) {
  const cancellationRegistry = deps.jobCancellationRegistry ?? new JobCancellationRegistry();
  const researchService = new PrepResearchService(
    deps.llmClient,
    deps.interviewPrepRepository,
    cancellationRegistry
  );
  const importDeps = {
    llmClient: deps.llmClient,
    repository: deps.interviewPrepRepository,
    cancellationRegistry
  };

  app.get("/api/interview/status", async () => ({
    aiConfigured: deps.llmClient.isConfigured()
  }));

  app.get("/api/interview/knowledge", async (request) => {
    const docs = await deps.interviewPrepRepository.listKnowledgeDocs(request.user.id);
    return docs.map(toKnowledgeDocDto);
  });

  app.post("/api/interview/knowledge", async (request, reply) => {
    const body = knowledgeDocInputSchema.parse(request.body);
    const contentHash = sha256Content(body.content);
    const existing = await deps.interviewPrepRepository.findKnowledgeByHash(request.user.id, contentHash);
    if (existing) {
      return reply.code(200).send({ doc: toKnowledgeDocDto(existing), deduplicated: true });
    }
    const doc = await deps.interviewPrepRepository.createKnowledgeDoc(request.user.id, {
      kind: body.kind ?? inferKnowledgeKind({ title: body.title, content: body.content }),
      title: body.title,
      content: body.content,
      contentHash
    });
    await reindexBankQuestionsForDoc(deps.interviewPrepRepository, request.user.id, doc.id);
    await queueQuestionCleanup(importDeps, request.user.id, [doc.id]);
    return reply.code(201).send({ doc: toKnowledgeDocDto(doc), deduplicated: false });
  });

  app.put("/api/interview/knowledge/:id", async (request, reply) => {
    const body = knowledgeDocInputSchema.parse(request.body);
    const contentHash = sha256Content(body.content);
    const doc = await deps.interviewPrepRepository.updateKnowledgeDoc(
      request.user.id,
      (request.params as { id: string }).id,
      {
        kind: body.kind ?? inferKnowledgeKind({ title: body.title, content: body.content }),
        title: body.title,
        content: body.content,
        contentHash
      }
    );
    if (!doc) return reply.code(404).send({ message: "Dokument ikke funnet." });
    await reindexBankQuestionsForDoc(deps.interviewPrepRepository, request.user.id, doc.id);
    await queueQuestionCleanup(importDeps, request.user.id, [doc.id]);
    return toKnowledgeDocDto(doc);
  });

  app.delete("/api/interview/knowledge/:id", async (request, reply) => {
    const deleted = await deps.interviewPrepRepository.deleteKnowledgeDoc(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Dokument ikke funnet." });
  });

  app.post("/api/interview/knowledge/import", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ message: "Mangler fil." });
    const buffer = await file.toBuffer();
    const filename = file.filename ?? "upload.txt";
    let imported;
    try {
      imported = await importDocumentText(filename, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import feilet.";
      return reply.code(400).send({ message });
    }

    const title = filename.replace(/\.[^.]+$/, "");
    const kind = inferKnowledgeKind({ filename, title, content: imported.text });
    const contentHash = sha256Content(imported.text);
    const existingDoc = await deps.interviewPrepRepository.findKnowledgeByHash(request.user.id, contentHash);
    let originalFileKey: string | undefined;
    if (!existingDoc && filename.toLowerCase().endsWith(".pdf")) {
      originalFileKey = buildInterviewStoragePath(request.user.id, nanoid(), filename);
      await writeInterviewFile(originalFileKey, buffer);
    }
    const doc =
      existingDoc ??
      (await deps.interviewPrepRepository.createKnowledgeDoc(request.user.id, {
        kind,
        title,
        content: imported.text,
        sourceFilename: filename,
        contentHash,
        originalFileKey
      }));

    await reindexBankQuestionsForDoc(deps.interviewPrepRepository, request.user.id, doc.id);
    await queueQuestionCleanup(importDeps, request.user.id, [doc.id]);

    let caseEntry = null;
    const sourceKind = classifyCaseSource({
      filename,
      title,
      content: imported.text,
      entryCount: imported.entryCount
    });

    const chunked = shouldChunkImport({ content: imported.text, sourceKind });

    if ((kind === "case" || kind === "practice") && !chunked && sourceKind !== "exhibit_pack") {
      const sections = parseCaseSections(imported.text);
      const caseHash = sha256Content(`${title}:${sections.prompt}:${sections.solution}`);
      const existingCase = await deps.interviewPrepRepository.findCaseByHash(request.user.id, caseHash);
      caseEntry = existingCase
        ? toPublicCaseDto(existingCase)
        : toPublicCaseDto(
            await deps.interviewPrepRepository.createCaseEntry(request.user.id, {
              title,
              prompt: sections.prompt || imported.text.slice(0, 4000),
              interviewerInfo: sections.interviewerInfo,
              solution: sections.solution,
              sourceKind,
              companyTags: [],
              knowledgeDocId: doc.id,
              contentHash: caseHash,
              originalFileKey: doc.originalFileKey
            })
          );
    }

    let importJob = null;
    const caseJobs = await deps.interviewPrepRepository.listImportJobsForDoc(
      request.user.id,
      doc.id,
      "cases"
    );
    if ((chunked || sourceKind === "exhibit_pack") && !hasCompletedImportJob(caseJobs, "cases")) {
      importJob = await ensureImportJob(importDeps, request.user.id, doc.id, "cases");
    }

    const extractedCount = extractBankQuestions({
      kind: doc.kind,
      title: doc.title,
      content: doc.content
    }).length;
    if (shouldQueueQuestionImport(doc, extractedCount)) {
      const questionJob = await ensureImportJob(importDeps, request.user.id, doc.id, "questions");
      if (!importJob && questionJob) importJob = questionJob;
    }

    return reply.code(existingDoc ? 200 : 201).send({
      doc: toKnowledgeDocDto(doc),
      caseEntry,
      importJob,
      deduplicated: Boolean(existingDoc)
    });
  });

  app.get("/api/interview/questions", async (request) => {
    const query = bankQuestionQuerySchema.parse(request.query ?? {});
    const rows = await deps.interviewPrepRepository.listBankQuestions(request.user.id, query);
    return rows.map(toBankQuestionDto);
  });

  app.get("/api/interview/questions/summary", async (request) => {
    return deps.interviewPrepRepository.summarizeBankQuestions(request.user.id);
  });

  app.patch("/api/interview/questions/:id", async (request, reply) => {
    const body = patchBankQuestionSchema.parse(request.body);
    const id = (request.params as { id: string }).id;
    const [existing] = await deps.interviewPrepRepository.getBankQuestionsByIds(request.user.id, [id]);
    if (!existing) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    const audience = body.audience ?? existing.audience;
    const updated = await deps.interviewPrepRepository.updateBankQuestion(request.user.id, id, {
      ...(body.text !== undefined ? { text: body.text } : {}),
      audience,
      category: categoryForAudience(audience, body.category ?? existing.category),
      origin: "manual",
      cleanedAt: new Date().toISOString()
    });
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toBankQuestionDto(updated);
  });

  app.post("/api/interview/questions/:id/discard", async (request, reply) => {
    const body = discardBankQuestionSchema.parse(request.body ?? {});
    const updated = await deps.interviewPrepRepository.updateBankQuestion(
      request.user.id,
      (request.params as { id: string }).id,
      { status: "discarded", discardReason: body.reason, origin: "manual", cleanedAt: new Date().toISOString() }
    );
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toBankQuestionDto(updated);
  });

  app.post("/api/interview/questions/:id/restore", async (request, reply) => {
    const updated = await deps.interviewPrepRepository.updateBankQuestion(
      request.user.id,
      (request.params as { id: string }).id,
      { status: "active", discardReason: null, origin: "manual", cleanedAt: new Date().toISOString() }
    );
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toBankQuestionDto(updated);
  });

  app.post("/api/interview/questions/cleanup", async (request, reply) => {
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const body = questionCleanupRequestSchema.parse(request.body ?? {});
    if (body.reset) await deps.interviewPrepRepository.resetBankQuestionCleanup(request.user.id);
    const jobs = await queueQuestionCleanup(importDeps, request.user.id);
    const summary = await deps.interviewPrepRepository.summarizeBankQuestions(request.user.id);
    return {
      queuedJobs: jobs,
      uncleaned: summary.uncleaned,
      message:
        jobs.length === 0
          ? summary.uncleaned === 0
            ? "Alle spørsmål er ryddet."
            : "Opprydding pågår allerede."
          : `${summary.uncleaned} spørsmål i ${jobs.length} dokumenter ryddes`
    };
  });

  app.post("/api/interview/questions/reindex", async (request) => {
    const docs = await deps.interviewPrepRepository.listKnowledgeDocs(request.user.id);
    const { inserted, removed } = await reindexAllBankQuestions(deps.interviewPrepRepository, request.user.id);
    const queuedJobs = await queueQuestionImportsForSparseDocs(importDeps, request.user.id);
    const cleanupJobs = await queueQuestionCleanup(importDeps, request.user.id);
    return {
      indexed: inserted,
      removed,
      queuedJobs,
      cleanupJobs: cleanupJobs.length,
      documentCount: docs.length,
      message:
        docs.length === 0
          ? "0 dokumenter i biblioteket"
          : `${inserted} nye spørsmål, ${removed} fjernet, ${queuedJobs} dokumenter behandles, ${cleanupJobs.length} ryddes`
    };
  });

  app.get("/api/interview/cases", async (request) => {
    const query = request.query as {
      q?: string;
      sourceKind?: string;
      style?: string;
      approvalStatus?: string;
    };
    const entries = await deps.interviewPrepRepository.searchCaseEntries(request.user.id, query);
    return entries.map(toPublicCaseDto);
  });

  app.post("/api/interview/cases/:id/approve", async (request, reply) => {
    const updated = await deps.interviewPrepRepository.approveCaseEntry(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!updated) return reply.code(404).send({ message: "Case ikke funnet." });
    return toPublicCaseDto(updated);
  });

  app.post("/api/interview/cases/:id/reject", async (request, reply) => {
    const updated = await deps.interviewPrepRepository.rejectCaseEntry(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!updated) return reply.code(404).send({ message: "Case ikke funnet." });
    return toPublicCaseDto(updated);
  });

  app.get("/api/interview/import-jobs", async (request) => {
    const jobs = await deps.interviewPrepRepository.listImportJobs(request.user.id);
    return jobs.map(toImportJobDto);
  });

  app.post("/api/interview/import-jobs/:id/retry", async (request, reply) => {
    const jobId = (request.params as { id: string }).id;
    const job = await deps.interviewPrepRepository.getImportJob(request.user.id, jobId);
    if (!job) return reply.code(404).send({ message: "Jobb ikke funnet." });
    if (job.status !== "failed" && job.status !== "cancelled") {
      return reply.code(409).send({ message: "Jobben kan bare kjøres på nytt når den har feilet eller er stoppet." });
    }
    const queued = await deps.interviewPrepRepository.updateImportJob(request.user.id, jobId, {
      status: "queued",
      message: "Fortsetter fra første uferdige del…"
    });
    startImportJob(importDeps, request.user.id, job);
    return queued ? toImportJobDto(queued) : toImportJobDto(job);
  });

  app.delete("/api/interview/import-jobs/:id", async (request, reply) => {
    const jobId = (request.params as { id: string }).id;
    const job = await deps.interviewPrepRepository.getImportJob(request.user.id, jobId);
    if (!job) return reply.code(404).send({ message: "Jobb ikke funnet." });
    if (!canDeleteImportJob(job.status)) {
      return reply.code(409).send({ message: "Jobben kan bare slettes når den er stoppet eller ferdig." });
    }
    const deleted = await deps.interviewPrepRepository.deleteImportJob(request.user.id, jobId);
    if (!deleted) {
      return reply.code(409).send({ message: "Jobben kan bare slettes når den er stoppet eller ferdig." });
    }
    return reply.code(204).send();
  });

  app.post("/api/interview/import-jobs/:id/cancel", async (request, reply) => {
    const result = await cancelImportJob(importDeps, request.user.id, (request.params as { id: string }).id);
    if (!result.ok) return reply.code(result.status).send({ message: result.message });
    const job = await deps.interviewPrepRepository.getImportJob(
      request.user.id,
      (request.params as { id: string }).id
    );
    return job ? toImportJobDto(job) : reply.code(404).send({ message: "Jobb ikke funnet." });
  });

  app.get("/api/interview/import-jobs/:id", async (request, reply) => {
    const job = await deps.interviewPrepRepository.getImportJob(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!job) return reply.code(404).send({ message: "Jobb ikke funnet." });
    return toImportJobDto(job);
  });

  app.get("/api/interview/cases/:id", async (request, reply) => {
    const entries = await deps.interviewPrepRepository.listCaseEntries(request.user.id);
    const entry = entries.find((item) => item.id === (request.params as { id: string }).id);
    if (!entry) return reply.code(404).send({ message: "Case ikke funnet." });
    return toFullCaseDto(entry);
  });

  app.post("/api/interview/cases", async (request, reply) => {
    const body = caseEntryInputSchema.parse(request.body);
    const contentHash = sha256Content(`${body.title}:${body.prompt}:${body.solution}:${body.interviewerInfo}`);
    const existing = await deps.interviewPrepRepository.findCaseByHash(request.user.id, contentHash);
    if (existing) {
      return reply.code(200).send({ case: toFullCaseDto(existing), deduplicated: true });
    }
    const created = await deps.interviewPrepRepository.createCaseEntry(request.user.id, {
      ...body,
      sourceKind: body.sourceKind ?? "single_case",
      contentHash
    });
    return reply.code(201).send({ case: toFullCaseDto(created), deduplicated: false });
  });

  app.put("/api/interview/cases/:id", async (request, reply) => {
    const body = caseEntryInputSchema.parse(request.body);
    const contentHash = sha256Content(`${body.title}:${body.prompt}:${body.solution}:${body.interviewerInfo}`);
    const updated = await deps.interviewPrepRepository.updateCaseEntry(
      request.user.id,
      (request.params as { id: string }).id,
      { ...body, sourceKind: body.sourceKind ?? "single_case", contentHash }
    );
    if (!updated) return reply.code(404).send({ message: "Case ikke funnet." });
    return toFullCaseDto(updated);
  });

  app.delete("/api/interview/cases/:id", async (request, reply) => {
    const deleted = await deps.interviewPrepRepository.deleteCaseEntry(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Case ikke funnet." });
  });

  app.get("/api/interview/plans", async (request) => {
    const plans = await deps.interviewPrepRepository.listPrepPlans(request.user.id);
    return plans.map(toPrepPlanDto);
  });

  app.get("/api/interview/plans/:id", async (request, reply) => {
    const plan = await deps.interviewPrepRepository.getPrepPlan(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!plan) return reply.code(404).send({ message: "Plan ikke funnet." });
    return { plan: toPrepPlanDto(plan), rankedCases: plan.recommendedCases };
  });

  app.get("/api/interview/plans/:id/company-report.pdf", async (request, reply) => {
    const plan = await deps.interviewPrepRepository.getPrepPlan(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!plan) return reply.code(404).send({ message: "Plan ikke funnet." });
    const raw = plan.companyReportJson?.trim();
    if (!raw || raw === "{}") {
      return reply.code(404).send({ message: "Bedriftsrapport er ikke klar ennå." });
    }
    let report;
    try {
      report = companyReportSchema.parse(JSON.parse(raw));
    } catch {
      return reply.code(404).send({ message: "Bedriftsrapport er ikke klar ennå." });
    }
    const pdf = await renderCompanyReportPdf(report, {
      companyName: plan.companyName,
      roleTitle: plan.roleTitle,
      generatedAt: plan.updatedAt
    });
    const filename = sanitizeReportFilename(plan.companyName);
    return reply
      .header("content-type", "application/pdf")
      .header("content-disposition", `attachment; filename="${filename}"`)
      .send(pdf);
  });

  app.put("/api/interview/plans/:id/questions/order", async (request, reply) => {
    const body = reorderPlanQuestionsSchema.parse(request.body);
    const planId = (request.params as { id: string }).id;
    const updated = await deps.interviewPrepRepository.reorderPlanQuestions(
      request.user.id,
      planId,
      body.orderedIds
    );
    if (!updated) {
      return reply.code(400).send({ message: "Rekkefølgen må inneholde nøyaktig alle spørsmålene i planen." });
    }
    return toPrepPlanDto(updated);
  });

  app.put("/api/interview/plans/:id/questions/:questionId", async (request, reply) => {
    const body = replacePlanQuestionSchema.parse(request.body);
    const planId = (request.params as { id: string }).id;
    const questionId = (request.params as { questionId: string }).questionId;

    if (body.storyId !== undefined) {
      const updated = await deps.interviewPrepRepository.setPlanQuestionStory(
        request.user.id,
        planId,
        questionId,
        body.storyId
      );
      if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
      return toPrepPlanDto(updated);
    }

    if (body.bankQuestionId) {
      const [bankQuestion] = await deps.interviewPrepRepository.getBankQuestionsByIds(request.user.id, [
        body.bankQuestionId
      ]);
      if (!bankQuestion) return reply.code(400).send({ message: "Bankspørsmål ikke funnet." });
      if (bankQuestion.status === "discarded") {
        return reply.code(400).send({ message: "Bankspørsmålet er forkastet." });
      }
      const updated = await deps.interviewPrepRepository.replacePlanQuestion(
        request.user.id,
        planId,
        questionId,
        {
          text: bankQuestion.text,
          category: bankQuestion.category,
          target: body.target ?? "interview",
          source: "bank",
          bankQuestionId: bankQuestion.id,
          storyId: body.storyId ?? undefined
        }
      );
      if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
      return toPrepPlanDto(updated);
    }

    if (!body.text || !body.category || !body.target) {
      return reply.code(400).send({ message: "Mangler tekst/kategori/mål for erstatning." });
    }
    const updated = await deps.interviewPrepRepository.replacePlanQuestion(
      request.user.id,
      planId,
      questionId,
      {
        text: body.text,
        category: body.category,
        target: body.target,
        source: "generated",
        storyId: body.storyId ?? undefined
      }
    );
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toPrepPlanDto(updated);
  });

  app.patch("/api/interview/plans/:id/questions/:questionId", async (request, reply) => {
    const body = patchPlanQuestionSchema.parse(request.body);
    const planId = (request.params as { id: string }).id;
    const questionId = (request.params as { questionId: string }).questionId;
    const plan = await deps.interviewPrepRepository.getPrepPlan(request.user.id, planId);
    if (!plan) return reply.code(404).send({ message: "Plan ikke funnet." });
    const existing = plan.questions.find((q) => q.id === questionId);
    if (!existing) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    const textChanged = body.text !== undefined && body.text !== existing.text;
    const updated = await deps.interviewPrepRepository.patchPlanQuestion(
      request.user.id,
      planId,
      questionId,
      {
        ...body,
        ...(body.category !== undefined ? { category: categoryForAudience(existing.audience, body.category) } : {}),
        source: textChanged ? "edited" : undefined
      }
    );
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toPrepPlanDto(updated);
  });

  app.post("/api/interview/plans/:id/questions", async (request, reply) => {
    const body = addPlanQuestionSchema.parse(request.body);
    const planId = (request.params as { id: string }).id;
    const updated = await deps.interviewPrepRepository.addPlanQuestion(request.user.id, planId, body);
    if (!updated) return reply.code(404).send({ message: "Plan ikke funnet." });
    return reply.code(201).send(toPrepPlanDto(updated));
  });

  app.delete("/api/interview/plans/:id/questions/:questionId", async (request, reply) => {
    const planId = (request.params as { id: string }).id;
    const questionId = (request.params as { questionId: string }).questionId;
    const updated = await deps.interviewPrepRepository.deletePlanQuestion(
      request.user.id,
      planId,
      questionId
    );
    if (!updated) return reply.code(404).send({ message: "Spørsmål ikke funnet." });
    return toPrepPlanDto(updated);
  });

  app.post("/api/interview/plans", async (request, reply) => {
    const body = prepPlanIntakeSchema.parse(request.body);
    const plan = await deps.interviewPrepRepository.createPrepPlan(request.user.id, body);
    return reply.code(201).send(toPrepPlanDto(plan));
  });

  app.post("/api/interview/plans/:id/research", async (request, reply) => {
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    try {
      const plan = await researchService.enqueueResearch(
        request.user.id,
        (request.params as { id: string }).id
      );
      return reply.code(202).send(toPrepPlanDto(plan));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research feilet.";
      return reply.code(400).send({ message });
    }
  });

  app.post("/api/interview/plans/:id/clarifications", async (request, reply) => {
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const body = clarificationAnswersSchema.parse(request.body);
    try {
      const plan = await researchService.enqueueClarifications(
        request.user.id,
        (request.params as { id: string }).id,
        body.answers,
        body.skip
      );
      return reply.code(202).send(toPrepPlanDto(plan));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kuratering feilet.";
      return reply.code(400).send({ message });
    }
  });

  app.post("/api/interview/plans/:id/cancel", async (request, reply) => {
    const result = await researchService.cancel(request.user.id, (request.params as { id: string }).id);
    if (!result.ok) return reply.code(result.status).send({ message: result.message });
    const plan = await deps.interviewPrepRepository.getPrepPlan(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!plan) return reply.code(404).send({ message: "Plan ikke funnet." });
    return toPrepPlanDto(plan);
  });

  app.get("/api/interview/simulator/settings/:mode", async (request, _reply) => {
    const mode = createSessionSchema.shape.mode.parse((request.params as { mode: string }).mode);
    const settings = await deps.interviewPrepRepository.getSimulatorSettings(request.user.id, mode);
    return settings ? toSimulatorSettingsDto(settings) : defaultSimulatorSettings(mode);
  });

  app.put("/api/interview/simulator/settings", async (request) => {
    const body = simulatorSettingsSchema.parse(request.body);
    const saved = await deps.interviewPrepRepository.upsertSimulatorSettings(request.user.id, {
      userId: request.user.id,
      ...body,
      essentialsSheet: normalizeEssentialsInput(body.mode, body.essentialsSheet)
    });
    return toSimulatorSettingsDto(saved);
  });

  app.post("/api/interview/simulator/settings/:mode/essentials-draft", async (request, reply) => {
    const mode = createSessionSchema.shape.mode.parse((request.params as { mode: string }).mode);
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const docs = await deps.interviewPrepRepository.listKnowledgeDocs(request.user.id);
    const sources = selectEssentialsSourceDocs(mode, docs);
    if (sources.length === 0) {
      return reply.code(400).send({ message: "Fant ingen dokumenter å lage utkast fra." });
    }
    const result = await deps.llmClient.completeStructured(
      {
        messages: [
          { role: "system", content: buildEssentialsDraftSystemPrompt(mode) },
          { role: "user", content: buildEssentialsDraftUserMessage(sources) }
        ]
      },
      essentialsDraftSchema
    );
    const draft = result.sheet.trim();
    if (!draft) return reply.code(502).send({ message: "KI-en returnerte et tomt utkast." });
    return { draft, sourceDocTitles: sources.map((source) => source.title) };
  });

  app.get("/api/interview/sessions", async (request) => {
    const mode = (request.query as { mode?: string }).mode;
    const parsedMode = mode ? createSessionSchema.shape.mode.parse(mode) : undefined;
    const sessions = await deps.interviewPrepRepository.listSessions(request.user.id, parsedMode);
    return sessions.map(toSessionDto);
  });

  app.post("/api/interview/sessions", async (request, reply) => {
    const body = createSessionSchema.parse(request.body);
    const settings =
      (await deps.interviewPrepRepository.getSimulatorSettings(request.user.id, body.mode)) ?? {
        userId: request.user.id,
        mode: body.mode,
        companyName: "",
        tone: DEFAULT_SIMULATOR_TONE,
        language: DEFAULT_SIMULATOR_LANGUAGE,
        essentialsSheet: null
      };
    // Only a sheet the user wrote goes into the prompt; the default is a cheat sheet with placeholders.
    const essentials = resolveEssentialsSheet(body.mode, settings.essentialsSheet);

    let planScript: string | undefined;
    let questionsToAsk: Array<{ text: string; audience: QuestionAudience }> = [];
    let planCompanyName = settings.companyName;
    if (body.prepPlanId) {
      const plan = await deps.interviewPrepRepository.getPrepPlan(request.user.id, body.prepPlanId);
      if (!plan) return reply.code(404).send({ message: "Plan ikke funnet." });
      if (!canStartSimulators(plan.status)) {
        return reply.code(409).send({ message: "Planen må være klar før du kan øve med den." });
      }
      planCompanyName = plan.companyName || settings.companyName;
      let profileSummary = "";
      try {
        const profile = JSON.parse(plan.companyProfileJson || "{}") as { summary?: string };
        profileSummary = profile.summary ?? "";
      } catch {
        profileSummary = "";
      }
      planScript = buildPlanPracticeScript({
        companyName: plan.companyName,
        roleTitle: plan.roleTitle,
        companyProfileSummary: profileSummary,
        questions: plan.questions
      });
      if (!planScript.trim()) {
        return reply.code(400).send({ message: "Planen har ingen spørsmål merket for øving." });
      }
      questionsToAsk = plan.questions
        .filter((q) => q.included && q.audience !== "candidate")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((q) => ({ text: q.text, audience: q.audience }));
    }

    let casePrompt: string | undefined;
    let interviewerInfo: string | undefined;
    let solution: string | undefined;
    let caseStyle: "interviewer_led" | "candidate_led" | undefined;
    if (body.caseEntryId) {
      const cases = await deps.interviewPrepRepository.listCaseEntries(request.user.id);
      const entry = cases.find((item) => item.id === body.caseEntryId);
      if (!entry) return reply.code(404).send({ message: "Case ikke funnet." });
      casePrompt = entry.prompt;
      interviewerInfo = entry.interviewerInfo;
      solution = entry.solution;
      caseStyle = entry.caseStyle;
    }

    const systemPrompt = buildSimulatorSystemPrompt({
      mode: body.mode,
      companyName: planCompanyName,
      tone: settings.tone,
      language: settings.language,
      essentialsSheet: essentials.isDefault ? "" : essentials.text,
      caseStyle,
      casePrompt,
      interviewerInfo,
      solution,
      planScript,
      questionsToAsk
    });
    const session = await deps.interviewPrepRepository.createSession(request.user.id, {
      mode: body.mode,
      title: body.title || `${body.mode} simulering`,
      prepPlanId: body.prepPlanId,
      caseEntryId: body.caseEntryId,
      systemPrompt,
      practice: body.practice
    });
    return reply.code(201).send(toSessionDto(session));
  });

  app.get("/api/interview/sessions/:id/messages", async (request, reply) => {
    const messages = await deps.interviewPrepRepository.listSessionMessages(
      request.user.id,
      (request.params as { id: string }).id
    );
    const session = await deps.interviewPrepRepository.getSession(
      request.user.id,
      (request.params as { id: string }).id
    );
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    return messages.map(toMessageDto);
  });

  app.post("/api/interview/sessions/:id/messages", async (request, reply) => {
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const sessionId = (request.params as { id: string }).id;
    const session = await deps.interviewPrepRepository.getSession(request.user.id, sessionId);
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    if (session.finishedAt) return reply.code(400).send({ message: "Sesjonen er avsluttet." });

    const body = sessionMessageSchema.parse(request.body);
    await deps.interviewPrepRepository.appendSessionMessage(request.user.id, sessionId, "user", body.content);

    const history = await deps.interviewPrepRepository.listSessionMessages(request.user.id, sessionId);
    const assistantText = await deps.llmClient.complete({
      messages: history.map((message) => ({ role: message.role, content: message.content }))
    });
    const assistantMessage = await deps.interviewPrepRepository.appendSessionMessage(
      request.user.id,
      sessionId,
      "assistant",
      assistantText
    );
    return toMessageDto(assistantMessage!);
  });

  app.post("/api/interview/sessions/:id/finish", async (request, reply) => {
    const sessionId = (request.params as { id: string }).id;
    const session = await deps.interviewPrepRepository.getSession(request.user.id, sessionId);
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    if (session.finishedAt) return reply.code(409).send({ message: "Sesjonen er allerede avsluttet." });

    if (session.practice) {
      const finished = await deps.interviewPrepRepository.finishSession(request.user.id, sessionId, null);
      if (!finished) return reply.code(409).send({ message: "Sesjonen er allerede avsluttet." });
      return toSessionDto(finished);
    }

    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }

    const history = await deps.interviewPrepRepository.listSessionMessages(request.user.id, sessionId);
    const transcript = formatSessionTranscriptForRubric(history);
    const defaultScores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;

    const structured = await deps.llmClient.completeStructured(
      {
        messages: [
          { role: "system", content: buildFinishRubricPrompt() },
          { role: "user", content: transcript }
        ]
      },
      interviewFeedbackRubricSchema
    ).catch(() => ({
      scores: defaultScores,
      sum: sumRubricScores(defaultScores),
      improvement: "Stram inn innledningen og tydeliggjør resultat tidligere."
    }));

    const feedback = interviewFeedbackRubricSchema.parse(structured);
    const finished = await deps.interviewPrepRepository.finishSession(request.user.id, sessionId, feedback);
    if (!finished) return reply.code(409).send({ message: "Sesjonen er allerede avsluttet." });
    return toSessionDto(finished);
  });

  app.post("/api/interview/voice/session", async (request, reply) => {
    const body = voiceSessionBodySchema.parse(request.body ?? {});
    const session = await deps.interviewPrepRepository.getSession(request.user.id, body.sessionId);
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    const messages = await deps.interviewPrepRepository.listSessionMessages(request.user.id, session.id);
    const systemPrompt = messages.find((m) => m.role === "system")?.content ?? "";
    return createVoiceSession(env, systemPrompt);
  });

  app.post("/api/interview/sessions/:id/transcript", async (request, reply) => {
    const sessionId = (request.params as { id: string }).id;
    const session = await deps.interviewPrepRepository.getSession(request.user.id, sessionId);
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    if (session.finishedAt) return reply.code(400).send({ message: "Sesjonen er avsluttet." });

    const body = transcriptMessageSchema.parse(request.body);
    const saved = await deps.interviewPrepRepository.appendSessionMessage(
      request.user.id,
      sessionId,
      body.role,
      body.content
    );
    if (!saved) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    return toMessageDto(saved);
  });

  app.get("/api/interview/video/settings", async (request) => {
    const row = await deps.interviewPrepRepository.getVideoSettings(request.user.id);
    if (!row) return defaultVideoSimulatorSettings;
    return toVideoSettingsDto(row);
  });

  app.put("/api/interview/video/settings", async (request) => {
    const body = videoSimulatorSettingsSchema.parse(request.body);
    const saved = await deps.interviewPrepRepository.upsertVideoSettings(request.user.id, body);
    return toVideoSettingsDto(saved);
  });

  app.get("/api/interview/video/runs", async (request) => {
    const runs = await deps.interviewPrepRepository.listVideoRuns(request.user.id);
    return runs.map(toVideoRunDto);
  });

  app.post("/api/interview/video/runs", async (request, reply) => {
    const body = videoRunInputSchema.parse(request.body);
    const run = await deps.interviewPrepRepository.createVideoRun(request.user.id, body);
    return reply.code(201).send(toVideoRunDto(run));
  });

  app.post("/api/interview/video/transcribe", async (request, reply) => {
    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | undefined;
    let filename = "answer.webm";
    let mimeType: string | undefined;

    const contentType = request.headers["content-type"] ?? "";
    if (contentType.includes("multipart/form-data")) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          filename = part.filename || filename;
          mimeType = part.mimetype || mimeType;
          fileBuffer = await part.toBuffer();
        } else {
          fields[part.fieldname] = String(part.value ?? "");
        }
      }
    } else {
      const body = (request.body ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) fields[key] = String(value);
      }
    }

    const parsed = videoTranscribeFieldsSchema.parse({
      ...fields,
      filename: fields.filename ?? filename,
      mimeType: fields.mimeType ?? mimeType
    });
    const withRubric = parseMultipartBool(parsed.withRubric);
    const prompt = parsed.prompt.trim();

    let transcript = parsed.note.trim();
    let mock = Boolean(transcript);

    if (!transcript) {
      if (!fileBuffer || fileBuffer.length === 0) {
        return reply.code(400).send({ message: "Mangler lyd for transkripsjon." });
      }
      if (!deps.llmClient.transcribe || !deps.llmClient.isConfigured()) {
        return reply.code(503).send({ message: "AI er ikke konfigurert." });
      }
      transcript = await deps.llmClient.transcribe({
        buffer: fileBuffer,
        filename: parsed.filename ?? filename,
        mimeType: parsed.mimeType ?? mimeType
      });
      mock = false;
    }

    const stats = answerStats(transcript, parsed.durationMs ?? 60_000);
    let feedback = null;
    let feedbackFallback = false;
    if (withRubric) {
      const defaultScores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
        (typeof starRubricCriteria)[number],
        number
      >;
      const rubricUserContent = prompt
        ? `Spørsmål: ${prompt}\n\nSvar: ${transcript}`
        : transcript;
      let usedFallback = false;
      feedback = await deps.llmClient
        .completeStructured(
          {
            messages: [
              { role: "system", content: buildFinishRubricPrompt() },
              { role: "user", content: rubricUserContent }
            ]
          },
          interviewFeedbackRubricSchema
        )
        .catch(() => {
          usedFallback = true;
          return {
            scores: defaultScores,
            sum: sumRubricScores(defaultScores),
            improvement: "Stram inn strukturen og reduser fyllord."
          };
        });
      feedbackFallback = usedFallback;
    }
    return { mock, transcript, stats, feedback, feedbackFallback };
  });

  app.get("/api/interview/ability/attempts", async (request) => {
    const attempts = await deps.interviewPrepRepository.listAbilityAttempts(request.user.id);
    return attempts.map(toAbilityAttemptDto);
  });

  app.post("/api/interview/ability/attempts", async (request, reply) => {
    const body = abilityAttemptInputSchema.parse(request.body);
    const attempt = await deps.interviewPrepRepository.createAbilityAttempt(request.user.id, body);
    return reply.code(201).send(toAbilityAttemptDto(attempt));
  });
}
