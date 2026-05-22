import type { FastifyInstance } from "fastify";
import { catalogLabelSchema } from "../schemas.js";
import { CatalogInUseError, type Repository } from "../repository.js";

async function handleCatalogError(error: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  if (error instanceof CatalogInUseError) {
    return reply.code(409).send({ message: error.message });
  }
  throw error;
}

export async function graduateProgramSettingsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/graduate-program-settings", async (request) =>
    repository.getGraduateProgramSettings(request.user.id)
  );

  app.post("/api/graduate-program-settings/statuses", async (request) =>
    repository.createGraduateProgramStatus(request.user.id, catalogLabelSchema.parse(request.body))
  );

  app.put("/api/graduate-program-settings/statuses/:id", async (request, reply) => {
    const result = await repository.updateGraduateProgramStatus(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Status ikke funnet." });
  });

  app.delete("/api/graduate-program-settings/statuses/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteGraduateProgramStatus(
        request.user.id,
        (request.params as { id: string }).id
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Status ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });

  app.post("/api/graduate-program-settings/locations", async (request) =>
    repository.createGraduateProgramLocation(request.user.id, catalogLabelSchema.parse(request.body))
  );

  app.put("/api/graduate-program-settings/locations/:id", async (request, reply) => {
    const result = await repository.updateGraduateProgramLocation(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Sted ikke funnet." });
  });

  app.delete("/api/graduate-program-settings/locations/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteGraduateProgramLocation(
        request.user.id,
        (request.params as { id: string }).id
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Sted ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });

  app.post("/api/graduate-program-settings/requirement-types", async (request) =>
    repository.createGraduateProgramRequirementType(request.user.id, catalogLabelSchema.parse(request.body))
  );

  app.put("/api/graduate-program-settings/requirement-types/:id", async (request, reply) => {
    const result = await repository.updateGraduateProgramRequirementType(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Kravtype ikke funnet." });
  });

  app.delete("/api/graduate-program-settings/requirement-types/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteGraduateProgramRequirementType(
        request.user.id,
        (request.params as { id: string }).id
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Kravtype ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });
}
