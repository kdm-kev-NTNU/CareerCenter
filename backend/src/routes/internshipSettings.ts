import type { FastifyInstance } from "fastify";
import { catalogLabelSchema, catalogReorderSchema } from "../schemas.js";
import { CatalogInUseError, type Repository } from "../repository.js";

async function handleCatalogError(error: unknown, reply: { code: (status: number) => { send: (body: unknown) => unknown } }) {
  if (error instanceof CatalogInUseError) {
    return reply.code(409).send({ message: error.message });
  }
  throw error;
}

export async function internshipSettingsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/internship-settings", async (request) => {
    return repository.getInternshipSettings(request.user.id);
  });

  app.post("/api/internship-settings/statuses", async (request) => {
    return repository.createInternshipStatus(request.user.id, catalogLabelSchema.parse(request.body));
  });

  app.put("/api/internship-settings/statuses/reorder", async (request) => {
    return repository.reorderInternshipStatuses(
      request.user.id,
      catalogReorderSchema.parse(request.body).ids
    );
  });

  app.put("/api/internship-settings/statuses/:id", async (request, reply) => {
    const result = await repository.updateInternshipStatus(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Status ikke funnet." });
  });

  app.delete("/api/internship-settings/statuses/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteInternshipStatus(request.user.id, (request.params as { id: string }).id);
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Status ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });

  app.post("/api/internship-settings/locations", async (request) => {
    return repository.createInternshipLocation(request.user.id, catalogLabelSchema.parse(request.body));
  });

  app.put("/api/internship-settings/locations/:id", async (request, reply) => {
    const result = await repository.updateInternshipLocation(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Sted ikke funnet." });
  });

  app.delete("/api/internship-settings/locations/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteInternshipLocation(request.user.id, (request.params as { id: string }).id);
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Sted ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });

  app.post("/api/internship-settings/requirement-types", async (request) => {
    return repository.createInternshipRequirementType(request.user.id, catalogLabelSchema.parse(request.body));
  });

  app.put("/api/internship-settings/requirement-types/:id", async (request, reply) => {
    const result = await repository.updateInternshipRequirementType(
      request.user.id,
      (request.params as { id: string }).id,
      catalogLabelSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Kravtype ikke funnet." });
  });

  app.delete("/api/internship-settings/requirement-types/:id", async (request, reply) => {
    try {
      const deleted = await repository.deleteInternshipRequirementType(request.user.id, (request.params as { id: string }).id);
      return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Kravtype ikke funnet." });
    } catch (error) {
      return handleCatalogError(error, reply);
    }
  });
}
