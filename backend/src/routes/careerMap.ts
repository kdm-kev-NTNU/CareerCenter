import { careerTracks } from "@careercenter/shared";
import type { CareerTrack } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { trackSchema } from "../schemas.js";

export async function careerMapRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/career-tracks", async () => repository.listCareerTracks());

  app.put("/api/career-tracks/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id as CareerTrack;
    if (!careerTracks.includes(id)) {
      return reply.code(404).send({ message: "Spor ikke funnet." });
    }
    const result = await repository.updateCareerTrack(id, trackSchema.parse(request.body));
    return result ?? reply.code(404).send({ message: "Spor ikke funnet." });
  });

  app.post("/api/career-tracks/:id/reset", async (request, reply) => {
    const id = (request.params as { id: string }).id as CareerTrack;
    if (!careerTracks.includes(id)) {
      return reply.code(404).send({ message: "Spor ikke funnet." });
    }
    const result = await repository.resetCareerTrack(id);
    return result ?? reply.code(404).send({ message: "Spor ikke funnet." });
  });

  app.delete("/api/career-tracks/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id as CareerTrack;
    if (!careerTracks.includes(id)) {
      return reply.code(404).send({ message: "Spor ikke funnet." });
    }
    const tracks = await repository.listCareerTracks();
    if (tracks.length <= 1) {
      return reply.code(409).send({ message: "Du må ha minst ett spor." });
    }
    const deleted = await repository.deleteCareerTrack(id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Spor ikke funnet." });
  });
}
