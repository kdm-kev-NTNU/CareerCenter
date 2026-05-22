import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { competitionSchema } from "../schemas.js";

export async function competitionsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/competitions", async (request) => repository.listCompetitions(request.user.id));

  app.post("/api/competitions", async (request) =>
    repository.createCompetition(request.user.id, competitionSchema.parse(request.body))
  );

  app.put("/api/competitions/:id", async (request, reply) => {
    const result = await repository.updateCompetition(
      request.user.id,
      (request.params as { id: string }).id,
      competitionSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Arrangement ikke funnet." });
  });

  app.delete("/api/competitions/:id", async (request, reply) => {
    const deleted = await repository.deleteCompetition(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Arrangement ikke funnet." });
  });
}
