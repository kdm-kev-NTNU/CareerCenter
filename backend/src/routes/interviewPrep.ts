import {
  answerStats,
  classifyCaseSource,
  defaultVideoSimulatorSettings,
  inferKnowledgeKind,
  starRubricCriteria,
  storiesToAnkiCsv,
  storyToAnkiRow,
  videoSimulatorSettingsSchema,
  weakestStoryQueue
} from "@careercenter/shared";
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
import { importDocumentText } from "../interview/importDocumentText.js";
import { processImportJob } from "../interview/importJobService.js";
import { buildInterviewStoragePath, writeInterviewFile } from "../interview/interviewFileStorage.js";
import {
  caseEntryInputSchema,
  clarificationAnswersSchema,
  createSessionSchema,
  knowledgeDocInputSchema,
  prepPlanIntakeSchema,
  replacePlanQuestionSchema,
  sessionMessageSchema,
  simulatorSettingsSchema
} from "../interview/knowledgeSchemas.js";
import {
  toAbilityAttemptDto,
  toRepertoireDto,
  toStoryDto,
  toStoryScoreDto,
  toVideoRunDto,
  toVideoSettingsDto
} from "../interview/meccaMappers.js";
import {
  abilityAttemptInputSchema,
  repertoireLogInputSchema,
  storyBankInputSchema,
  storyScoreInputSchema,
  transcriptMessageSchema,
  videoRunInputSchema,
  videoTranscribeStubSchema
} from "../interview/meccaSchemas.js";
import { PrepResearchService } from "../interview/prepResearchService.js";
import { reindexAllBankQuestions, reindexBankQuestionsForDoc } from "../interview/reindexBankQuestions.js";
import { buildFinishRubricPrompt, buildSimulatorSystemPrompt } from "../interview/prompts.js";
import { createVoiceSession } from "../interview/voiceSession.js";
import type { InterviewPrepRepository } from "../interviewPrepRepository.js";

export interface InterviewPrepRouteDeps {
  llmClient: LlmClient;
  interviewPrepRepository: InterviewPrepRepository;
}

export async function interviewPrepRoutes(app: FastifyInstance, deps: InterviewPrepRouteDeps) {
  const researchService = new PrepResearchService(deps.llmClient, deps.interviewPrepRepository);

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

    let caseEntry = null;
    const sourceKind = classifyCaseSource({
      filename,
      title,
      content: imported.text,
      entryCount: imported.entryCount
    });

    if ((kind === "case" || kind === "practice") && sourceKind !== "casebook" && sourceKind !== "exhibit_pack") {
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
    if (!existingDoc && (sourceKind === "casebook" || sourceKind === "exhibit_pack")) {
      importJob = await deps.interviewPrepRepository.createImportJob(request.user.id, {
        knowledgeDocId: doc.id
      });
      void processImportJob(
        { llmClient: deps.llmClient, repository: deps.interviewPrepRepository },
        request.user.id,
        importJob.id
      );
    }

    return reply.code(existingDoc ? 200 : 201).send({
      doc: toKnowledgeDocDto(doc),
      caseEntry,
      importJob: importJob ? toImportJobDto(importJob) : null,
      deduplicated: Boolean(existingDoc)
    });
  });

  app.get("/api/interview/questions", async (request) => {
    const query = request.query as { q?: string; category?: string; tag?: string };
    const rows = await deps.interviewPrepRepository.listBankQuestions(request.user.id, query);
    return rows.map(toBankQuestionDto);
  });

  app.post("/api/interview/questions/reindex", async (request) => {
    const count = await reindexAllBankQuestions(deps.interviewPrepRepository, request.user.id);
    return { indexed: count };
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

  app.get("/api/interview/simulator/settings/:mode", async (request, _reply) => {
    const mode = createSessionSchema.shape.mode.parse((request.params as { mode: string }).mode);
    const settings = await deps.interviewPrepRepository.getSimulatorSettings(request.user.id, mode);
    if (!settings) {
      return {
        mode,
        companyName: "",
        tone: "profesjonell",
        language: "nb",
        essentialsSheet: ""
      };
    }
    return toSimulatorSettingsDto(settings);
  });

  app.put("/api/interview/simulator/settings", async (request) => {
    const body = simulatorSettingsSchema.parse(request.body);
    const saved = await deps.interviewPrepRepository.upsertSimulatorSettings(request.user.id, {
      userId: request.user.id,
      ...body
    });
    return toSimulatorSettingsDto(saved);
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
        tone: "profesjonell",
        language: "nb",
        essentialsSheet: ""
      };

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
      companyName: settings.companyName,
      tone: settings.tone,
      language: settings.language,
      essentialsSheet: settings.essentialsSheet,
      caseStyle,
      casePrompt,
      interviewerInfo,
      solution
    });
    const session = await deps.interviewPrepRepository.createSession(request.user.id, {
      mode: body.mode,
      title: body.title || `${body.mode} simulering`,
      prepPlanId: body.prepPlanId,
      caseEntryId: body.caseEntryId,
      systemPrompt
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
    if (!deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const sessionId = (request.params as { id: string }).id;
    const session = await deps.interviewPrepRepository.getSession(request.user.id, sessionId);
    if (!session) return reply.code(404).send({ message: "Sesjon ikke funnet." });
    if (session.finishedAt) return reply.code(409).send({ message: "Sesjonen er allerede avsluttet." });

    const history = await deps.interviewPrepRepository.listSessionMessages(request.user.id, sessionId);
    const lastUser = [...history].reverse().find((message) => message.role === "user");
    const defaultScores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
      (typeof starRubricCriteria)[number],
      number
    >;

    const structured = await deps.llmClient.completeStructured(
      {
        messages: [
          { role: "system", content: buildFinishRubricPrompt() },
          { role: "user", content: lastUser?.content ?? "Ingen brukersvar." }
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

  app.post("/api/interview/voice/session", async () => createVoiceSession(env));

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
    const body = videoTranscribeStubSchema.parse(request.body ?? {});
    if (body.note.trim()) {
      const stats = answerStats(body.note, body.durationMs ?? 60_000);
      return { mock: true, transcript: body.note.trim(), blobKey: body.blobKey, stats };
    }
    if (!body.audioBase64) {
      return reply.code(400).send({ message: "Mangler lyd for transkripsjon." });
    }
    if (!deps.llmClient.transcribe || !deps.llmClient.isConfigured()) {
      return reply.code(503).send({ message: "AI er ikke konfigurert." });
    }
    const buffer = Buffer.from(body.audioBase64, "base64");
    const transcript = await deps.llmClient.transcribe({
      buffer,
      filename: body.filename ?? "answer.webm",
      mimeType: body.mimeType
    });
    const stats = answerStats(transcript, body.durationMs ?? 60_000);
    let feedback = null;
    if (body.withRubric) {
      const defaultScores = Object.fromEntries(starRubricCriteria.map((key) => [key, 3])) as Record<
        (typeof starRubricCriteria)[number],
        number
      >;
      feedback = await deps.llmClient
        .completeStructured(
          {
            messages: [
              { role: "system", content: buildFinishRubricPrompt() },
              { role: "user", content: transcript }
            ]
          },
          interviewFeedbackRubricSchema
        )
        .catch(() => ({
          scores: defaultScores,
          sum: sumRubricScores(defaultScores),
          improvement: "Stram inn strukturen og reduser fyllord."
        }));
    }
    return { mock: false, transcript, blobKey: body.blobKey, stats, feedback };
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

  app.get("/api/interview/stories", async (request) => {
    const stories = await deps.interviewPrepRepository.listStoryBankEntries(request.user.id);
    const dtos = await Promise.all(
      stories.map(async (story) => {
        const scores = await deps.interviewPrepRepository.listStoryScores(request.user.id, story.id);
        return toStoryDto(story, scores);
      })
    );
    return dtos;
  });

  app.get("/api/interview/stories/weakest", async (request) => {
    const stories = await deps.interviewPrepRepository.listStoryBankEntries(request.user.id);
    const enriched = await Promise.all(
      stories.map(async (story) => {
        const scores = await deps.interviewPrepRepository.listStoryScores(request.user.id, story.id);
        const dto = toStoryDto(story, scores);
        return {
          ...dto,
          scoreHistory: scores.map((score) => ({
            scores: score.scores,
            sum: score.sum,
            createdAt: score.createdAt
          }))
        };
      })
    );
    return weakestStoryQueue(enriched);
  });

  app.get("/api/interview/stories/export/anki.csv", async (request, reply) => {
    const stories = await deps.interviewPrepRepository.listStoryBankEntries(request.user.id);
    const rows = stories.map((story) =>
      storyToAnkiRow({
        title: story.title,
        situation: story.situation,
        task: story.task,
        action: story.action,
        result: story.result,
        tags: story.tags
      })
    );
    const csv = storiesToAnkiCsv(rows);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="interview-mecca-star.csv"');
    return csv;
  });

  app.post("/api/interview/stories", async (request, reply) => {
    const body = storyBankInputSchema.parse(request.body);
    const story = await deps.interviewPrepRepository.createStoryBankEntry(request.user.id, body);
    return reply.code(201).send(toStoryDto(story, []));
  });

  app.put("/api/interview/stories/:id", async (request, reply) => {
    const body = storyBankInputSchema.parse(request.body);
    const updated = await deps.interviewPrepRepository.updateStoryBankEntry(
      request.user.id,
      (request.params as { id: string }).id,
      body
    );
    if (!updated) return reply.code(404).send({ message: "Historie ikke funnet." });
    const scores = await deps.interviewPrepRepository.listStoryScores(request.user.id, updated.id);
    return toStoryDto(updated, scores);
  });

  app.delete("/api/interview/stories/:id", async (request, reply) => {
    const deleted = await deps.interviewPrepRepository.deleteStoryBankEntry(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Historie ikke funnet." });
  });

  app.get("/api/interview/stories/:id/scores", async (request, reply) => {
    const storyId = (request.params as { id: string }).id;
    const story = await deps.interviewPrepRepository.getStoryBankEntry(request.user.id, storyId);
    if (!story) return reply.code(404).send({ message: "Historie ikke funnet." });
    const scores = await deps.interviewPrepRepository.listStoryScores(request.user.id, storyId);
    return scores.map(toStoryScoreDto);
  });

  app.post("/api/interview/stories/:id/scores", async (request, reply) => {
    const storyId = (request.params as { id: string }).id;
    const body = storyScoreInputSchema.parse(request.body);
    const sum = sumRubricScores(body.scores);
    const saved = await deps.interviewPrepRepository.addStoryScore(request.user.id, storyId, {
      scores: body.scores,
      sum,
      note: body.note
    });
    if (!saved) return reply.code(404).send({ message: "Historie ikke funnet." });
    return reply.code(201).send(toStoryScoreDto(saved));
  });

  app.get("/api/interview/repertoire", async (request) => {
    const rows = await deps.interviewPrepRepository.listRepertoireLogs(request.user.id);
    return rows.map(toRepertoireDto);
  });

  app.post("/api/interview/repertoire", async (request, reply) => {
    const body = repertoireLogInputSchema.parse(request.body);
    const row = await deps.interviewPrepRepository.createRepertoireLog(request.user.id, body);
    return reply.code(201).send(toRepertoireDto(row));
  });
}
