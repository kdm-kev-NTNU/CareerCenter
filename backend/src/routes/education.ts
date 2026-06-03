import type { FastifyInstance } from "fastify";
import type { AiResource } from "@careercenter/shared";
import type { Repository } from "../repository.js";
import {
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
