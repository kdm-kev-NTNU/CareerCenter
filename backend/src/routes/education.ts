import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { aiResourceExportTargets, type AiResource, type AiResourceExportTarget } from "@careercenter/shared";
import { syncAiResources } from "../../../scripts/ai-resource-sync.mjs";
import {
  buildAiResourceExportBundle,
  discoverAiResourceFiles,
  inferAiResourceFromFile,
  AiResourceImportError
} from "../aiResources.js";
import { normalizeFolderPath } from "../aiResourceFolders.js";
import type { AiResourceInput } from "../repository.js";
import type { Repository } from "../repository.js";
import {
  aiResourceImportSchema,
  aiResourceScanRequestSchema,
  aiResourceSchema,
  aiResourceSyncRequestSchema,
  bachelorKnowledgeSchema,
  educationBookSchema,
  learningPlatformSchema,
  selfStudyCourseSchema
} from "../schemas.js";

export async function educationRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/education/courses", async (request) => repository.listSelfStudyCourses(request.user.id));

  app.post("/api/education/courses", async (request) =>
    repository.createSelfStudyCourse(request.user.id, selfStudyCourseSchema.parse(request.body))
  );

  app.put("/api/education/courses/:id", async (request, reply) => {
    const result = await repository.updateSelfStudyCourse(
      request.user.id,
      (request.params as { id: string }).id,
      selfStudyCourseSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Kurs ikke funnet." });
  });

  app.delete("/api/education/courses/:id", async (request, reply) => {
    const deleted = await repository.deleteSelfStudyCourse(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Kurs ikke funnet." });
  });

  app.get("/api/education/books", async (request) => repository.listEducationBooks(request.user.id));

  app.post("/api/education/books", async (request) =>
    repository.createEducationBook(request.user.id, educationBookSchema.parse(request.body))
  );

  app.put("/api/education/books/:id", async (request, reply) => {
    const result = await repository.updateEducationBook(
      request.user.id,
      (request.params as { id: string }).id,
      educationBookSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Bok ikke funnet." });
  });

  app.delete("/api/education/books/:id", async (request, reply) => {
    const deleted = await repository.deleteEducationBook(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Bok ikke funnet." });
  });

  app.get("/api/education/platforms", async (request) => repository.listLearningPlatforms(request.user.id));

  app.post("/api/education/platforms", async (request) =>
    repository.createLearningPlatform(request.user.id, learningPlatformSchema.parse(request.body))
  );

  app.put("/api/education/platforms/:id", async (request, reply) => {
    const result = await repository.updateLearningPlatform(
      request.user.id,
      (request.params as { id: string }).id,
      learningPlatformSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Plattform ikke funnet." });
  });

  app.delete("/api/education/platforms/:id", async (request, reply) => {
    const deleted = await repository.deleteLearningPlatform(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Plattform ikke funnet." });
  });

  app.get("/api/education/ai-resources", async (request) => {
    const query = request.query as {
      target?: string;
      kind?: string;
      status?: string;
      tag?: string;
      q?: string;
      folderPath?: string;
      starred?: string;
      frequent?: string;
    };
    const resources = await repository.listAiResources(request.user.id);
    return filterAiResources(resources, query);
  });

  app.post("/api/education/ai-resources", async (request) =>
    repository.createAiResource(request.user.id, normalizeAiResourceInput(aiResourceSchema.parse(request.body)))
  );

  app.post("/api/education/ai-resources/import", async (request) => {
    const payload = aiResourceImportSchema.parse(request.body);
    const existingResources = await repository.listAiResources(request.user.id);
    const existingByPath = new Map(
      existingResources
        .filter((resource) => resource.installPath)
        .map((resource) => [resource.installPath.toLowerCase(), resource])
    );
    const result: {
      created: AiResource[];
      updated: AiResource[];
      rejected: Array<{ fileName: string; message: string }>;
    } = { created: [], updated: [], rejected: [] };

    for (const file of payload.files) {
      try {
        const input = inferAiResourceFromFile(file);
        const existing = input.installPath ? existingByPath.get(input.installPath.toLowerCase()) : undefined;
        if (existing) {
          const updated = await repository.updateAiResource(request.user.id, existing.id, preserveAiResourceMetadata(input, existing));
          if (updated) {
            result.updated.push(updated);
            existingByPath.set(updated.installPath.toLowerCase(), updated);
          }
        } else {
          const created = await repository.createAiResource(request.user.id, input);
          result.created.push(created);
          if (created.installPath) {
            existingByPath.set(created.installPath.toLowerCase(), created);
          }
        }
      } catch (error) {
        result.rejected.push({
          fileName: file.fileName,
          message: error instanceof AiResourceImportError || error instanceof Error
            ? error.message
            : "Kunne ikke importere filen."
        });
      }
    }

    return result;
  });

  app.get("/api/education/ai-resources/export", async (request, reply) => {
    const query = request.query as { target?: string };
    const target = (query.target ?? "all") as AiResourceExportTarget;
    if (!aiResourceExportTargets.includes(target)) {
      return reply.code(400).send({ message: "Ugyldig eksportmål." });
    }
    const resources = (await repository.listAiResources(request.user.id)).filter((resource) => resource.status !== "archived");
    return buildAiResourceExportBundle(resources, target);
  });

  app.post("/api/education/ai-resources/sync", async (request, reply) => {
    const body = aiResourceSyncRequestSchema.parse(request.body);
    const cwd = await resolveAndValidateCwd(body.cwd, reply);
    if (!cwd) return;

    const resources = (await repository.listAiResources(request.user.id)).filter((resource) => resource.status !== "archived");
    const bundle = buildAiResourceExportBundle(resources, body.target);
    const result = await syncAiResources({
      bundle,
      cwd,
      target: body.target,
      yes: true,
      force: body.force
    });

    return {
      dryRun: result.dryRun,
      target: result.target,
      cwd: result.cwd,
      files: result.files,
      conflicts: result.conflicts,
      rejected: result.rejected
    };
  });

  app.post("/api/education/ai-resources/scan", async (request, reply) => {
    const body = aiResourceScanRequestSchema.parse(request.body);
    const cwd = await resolveAndValidateCwd(body.cwd, reply);
    if (!cwd) return;

    const discovered = await discoverAiResourceFiles(cwd);
    if (discovered.length === 0) {
      return { created: [], updated: [], rejected: [], scanned: 0 };
    }

    const existingResources = await repository.listAiResources(request.user.id);
    const existingByPath = new Map(
      existingResources
        .filter((resource) => resource.installPath)
        .map((resource) => [resource.installPath.toLowerCase(), resource])
    );
    const result: {
      created: AiResource[];
      updated: AiResource[];
      rejected: Array<{ fileName: string; message: string }>;
      scanned: number;
    } = { created: [], updated: [], rejected: [], scanned: discovered.length };

    for (const file of discovered) {
      try {
        const input = inferAiResourceFromFile(file);
        const existing = input.installPath ? existingByPath.get(input.installPath.toLowerCase()) : undefined;
        if (existing) {
          const updated = await repository.updateAiResource(request.user.id, existing.id, preserveAiResourceMetadata(input, existing));
          if (updated) {
            result.updated.push(updated);
            existingByPath.set(updated.installPath.toLowerCase(), updated);
          }
        } else {
          const created = await repository.createAiResource(request.user.id, input);
          result.created.push(created);
          if (created.installPath) {
            existingByPath.set(created.installPath.toLowerCase(), created);
          }
        }
      } catch (error) {
        result.rejected.push({
          fileName: file.fileName,
          message: error instanceof AiResourceImportError || error instanceof Error
            ? error.message
            : "Kunne ikke importere filen."
        });
      }
    }

    return result;
  });

  app.put("/api/education/ai-resources/:id", async (request, reply) => {
    const result = await repository.updateAiResource(
      request.user.id,
      (request.params as { id: string }).id,
      normalizeAiResourceInput(aiResourceSchema.parse(request.body))
    );
    return result ?? reply.code(404).send({ message: "AI-ressurs ikke funnet." });
  });

  app.post("/api/education/ai-resources/:id/used", async (request, reply) => {
    const result = await repository.markAiResourceUsed(request.user.id, (request.params as { id: string }).id);
    return result ?? reply.code(404).send({ message: "AI-ressurs ikke funnet." });
  });

  app.delete("/api/education/ai-resources/:id", async (request, reply) => {
    const deleted = await repository.deleteAiResource(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "AI-ressurs ikke funnet." });
  });

  app.get("/api/education/bachelor", async (request) => {
    const query = request.query as { folderId?: string };
    const folderId = query.folderId === undefined ? undefined : query.folderId === "" ? null : query.folderId;
    return repository.listBachelorKnowledge(request.user.id, folderId);
  });

  app.post("/api/education/bachelor", async (request) =>
    repository.createBachelorKnowledge(request.user.id, bachelorKnowledgeSchema.parse(request.body))
  );

  app.put("/api/education/bachelor/:id", async (request, reply) => {
    const result = await repository.updateBachelorKnowledge(
      request.user.id,
      (request.params as { id: string }).id,
      bachelorKnowledgeSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Oppføring ikke funnet." });
  });

  app.delete("/api/education/bachelor/:id", async (request, reply) => {
    const deleted = await repository.deleteBachelorKnowledge(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Oppføring ikke funnet." });
  });
}

async function resolveAndValidateCwd(raw: string, reply: { code: (n: number) => { send: (body: unknown) => unknown } }): Promise<string | null> {
  const resolved = await resolveCwd(raw);
  if (!path.isAbsolute(raw) && raw !== resolved) {
    // Relative paths resolve against the backend process cwd which is misleading
  }
  try {
    const cwdStat = await stat(resolved);
    if (!cwdStat.isDirectory()) {
      reply.code(400).send({ message: `Stien er ikke en mappe: ${resolved}` });
      return null;
    }
  } catch {
    reply.code(400).send({ message: `Prosjektmappe finnes ikke: ${resolved}` });
    return null;
  }
  return resolved;
}

async function resolveCwd(raw: string): Promise<string> {
  const resolved = path.resolve(raw);
  if (await isDirectory(resolved)) return resolved;

  const windowsWorkspace = normalizeWindowsWorkspacePath(raw);
  if (!windowsWorkspace) return resolved;

  for (const candidateRoot of workspaceRootCandidates()) {
    const candidate = path.resolve(candidateRoot, windowsWorkspace.relativePath);
    if (await isDirectory(candidate)) return candidate;
  }

  return resolved;
}

function normalizeWindowsWorkspacePath(raw: string): { relativePath: string } | null {
  const normalized = raw.replace(/\\/g, "/");
  const marker = "/CareerCenter";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker.toLowerCase());
  if (!/^[A-Za-z]:\//.test(normalized) || markerIndex < 0) return null;

  const afterRoot = normalized.slice(markerIndex + marker.length).replace(/^\/+/, "");
  return { relativePath: afterRoot };
}

function workspaceRootCandidates() {
  return [
    path.resolve(process.cwd(), ".."),
    process.cwd()
  ];
}

async function isDirectory(candidate: string) {
  try {
    const cwdStat = await stat(candidate);
    return cwdStat.isDirectory();
  } catch {
    return false;
  }
}

function filterAiResources(
  resources: AiResource[],
  query: { target?: string; kind?: string; status?: string; tag?: string; q?: string; folderPath?: string; starred?: string; frequent?: string }
) {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim().toLowerCase();
  const folderPath = query.folderPath?.trim();
  const filtered = resources
    .filter((resource) => !query.target || resource.targetTools.includes(query.target as AiResource["targetTools"][number]))
    .filter((resource) => !query.kind || resource.kind === query.kind)
    .filter((resource) => !query.status || resource.status === query.status)
    .filter((resource) => !tag || resource.tags.some((item) => item.toLowerCase() === tag))
    .filter((resource) => !folderPath || resource.folderPath === folderPath)
    .filter((resource) => query.starred !== "true" || resource.isStarred)
    .filter((resource) => query.frequent !== "true" || resource.usageCount > 0)
    .filter(
      (resource) =>
        !search ||
        [
          resource.name,
          resource.kind,
          resource.installPath,
          resource.notes,
          resource.content,
          ...resource.tags,
          ...resource.targetTools
        ].join(" ").toLowerCase().includes(search)
    );
  if (query.frequent === "true") {
    return filtered.sort(
      (a, b) =>
        b.usageCount - a.usageCount ||
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") ||
        a.name.localeCompare(b.name)
    );
  }
  return filtered;
}

function normalizeAiResourceInput(input: AiResourceInput): AiResourceInput {
  return {
    ...input,
    folderPath: normalizeFolderPath(input.folderPath || "Inbox"),
    isStarred: input.isStarred === true,
    usageCount: input.usageCount ?? 0,
    lastUsedAt: input.lastUsedAt ?? null,
    sourcePath: input.sourcePath?.trim() || undefined
  };
}

function preserveAiResourceMetadata(input: AiResourceInput, existing: AiResource): AiResourceInput {
  return {
    ...input,
    folderPath: existing.folderPath || input.folderPath,
    isStarred: existing.isStarred,
    usageCount: existing.usageCount,
    lastUsedAt: existing.lastUsedAt ?? null,
    sourcePath: input.sourcePath || existing.sourcePath
  };
}
