import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { pathSchema } from "../schemas.js";

export async function pathsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/paths", async (request) => repository.listPaths(request.user.id));

  app.get("/api/paths/:id", async (request, reply) => {
    const path = await repository.getPath(request.user.id, (request.params as { id: string }).id);
    return path ?? reply.code(404).send({ message: "Path ikke funnet." });
  });

  app.post("/api/paths", async (request) =>
    repository.createPath(request.user.id, pathSchema.parse(request.body))
  );

  app.put("/api/paths/:id", async (request, reply) => {
    const result = await repository.updatePath(
      request.user.id,
      (request.params as { id: string }).id,
      pathSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Path ikke funnet." });
  });

  app.delete("/api/paths/:id", async (request, reply) => {
    const deleted = await repository.deletePath(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Path ikke funnet." });
  });
}
