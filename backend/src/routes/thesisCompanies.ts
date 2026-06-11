import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { thesisCompanySchema } from "../schemas.js";

export async function thesisCompaniesRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/thesis-companies", async (request) => repository.listThesisCompanies(request.user.id));

  app.post("/api/thesis-companies", async (request) =>
    repository.createThesisCompany(request.user.id, thesisCompanySchema.parse(request.body))
  );

  app.put("/api/thesis-companies/:id", async (request, reply) => {
    const result = await repository.updateThesisCompany(
      request.user.id,
      (request.params as { id: string }).id,
      thesisCompanySchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Bedrift ikke funnet." });
  });

  app.delete("/api/thesis-companies/:id", async (request, reply) => {
    const deleted = await repository.deleteThesisCompany(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Bedrift ikke funnet." });
  });
}
