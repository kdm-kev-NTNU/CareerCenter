import type { FastifyInstance } from "fastify";
import { aiResourceExportTargets, type AiResource, type AiResourceExportTarget } from "@careercenter/shared";
import {
  buildAiResourceExportBundle,
  inferAiResourceFromFile,
  AiResourceImportError
} from "../aiResources.js";
import type { Repository } from "../repository.js";
import {
  aiResourceImportSchema,
  aiResourceSchema,
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
    };
    const resources = await repository.listAiResources(request.user.id);
    return filterAiResources(resources, query);
  });

  app.post("/api/education/ai-resources", async (request) =>
    repository.createAiResource(request.user.id, aiResourceSchema.parse(request.body))
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
          const updated = await repository.updateAiResource(request.user.id, existing.id, input);
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

  app.put("/api/education/ai-resources/:id", async (request, reply) => {
    const result = await repository.updateAiResource(
      request.user.id,
      (request.params as { id: string }).id,
      aiResourceSchema.parse(request.body)
    );
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

function filterAiResources(
  resources: AiResource[],
  query: { target?: string; kind?: string; status?: string; tag?: string; q?: string }
) {
  const search = query.q?.trim().toLowerCase();
  const tag = query.tag?.trim().toLowerCase();
  return resources
    .filter((resource) => !query.target || resource.targetTools.includes(query.target as AiResource["targetTools"][number]))
    .filter((resource) => !query.kind || resource.kind === query.kind)
    .filter((resource) => !query.status || resource.status === query.status)
    .filter((resource) => !tag || resource.tags.some((item) => item.toLowerCase() === tag))
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
}
