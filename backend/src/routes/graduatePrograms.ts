import type { CareerTrack } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import { graduateProgramSchema } from "../schemas.js";
import type { GraduateProgramQuery, Repository } from "../repository.js";

export async function graduateProgramsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/graduate-programs", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const filters: GraduateProgramQuery = {
      q: query.q,
      statusId: query.statusId,
      locationId: query.locationId,
      track: query.track as CareerTrack | undefined
    };
    return repository.listGraduatePrograms(request.user.id, filters);
  });

  app.post("/api/graduate-programs", async (request) =>
    repository.createGraduateProgram(request.user.id, graduateProgramSchema.parse(request.body))
  );

  app.put("/api/graduate-programs/:id", async (request, reply) => {
    const result = await repository.updateGraduateProgram(
      request.user.id,
      (request.params as { id: string }).id,
      graduateProgramSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Graduate-program ikke funnet." });
  });

  app.delete("/api/graduate-programs/:id", async (request, reply) => {
    const deleted = await repository.deleteGraduateProgram(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Graduate-program ikke funnet." });
  });
}
