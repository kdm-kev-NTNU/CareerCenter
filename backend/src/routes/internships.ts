import type { CareerTrack } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import { internshipSchema } from "../schemas.js";
import type { InternshipQuery, Repository } from "../repository.js";

export async function internshipsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/internships", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const filters: InternshipQuery = {
      q: query.q,
      statusId: query.statusId,
      locationId: query.locationId,
      track: query.track as CareerTrack | undefined
    };
    return repository.listInternships(request.user.id, filters);
  });

  app.post("/api/internships", async (request) =>
    repository.createInternship(request.user.id, internshipSchema.parse(request.body))
  );

  app.put("/api/internships/:id", async (request, reply) => {
    const result = await repository.updateInternship(
      request.user.id,
      (request.params as { id: string }).id,
      internshipSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Internship ikke funnet." });
  });

  app.delete("/api/internships/:id", async (request, reply) => {
    const deleted = await repository.deleteInternship(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Internship ikke funnet." });
  });
}
