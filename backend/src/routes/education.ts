import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import {
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

  app.get("/api/education/bachelor", async (request) => repository.listBachelorKnowledge(request.user.id));

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
