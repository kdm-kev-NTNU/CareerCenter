import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { boardCreateSchema, boardUpdateSchema } from "../schemas.js";

export async function boardsRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/boards", async (request) => repository.listBoards(request.user.id));

  app.get("/api/boards/:id", async (request, reply) => {
    const board = await repository.getBoard(request.user.id, (request.params as { id: string }).id);
    return board ?? reply.code(404).send({ message: "Brett ikke funnet." });
  });

  app.post("/api/boards", async (request) =>
    repository.createBoard(request.user.id, boardCreateSchema.parse(request.body))
  );

  app.put("/api/boards/:id", async (request, reply) => {
    const result = await repository.updateBoard(
      request.user.id,
      (request.params as { id: string }).id,
      boardUpdateSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Brett ikke funnet." });
  });

  app.delete("/api/boards/:id", async (request, reply) => {
    const deleted = await repository.deleteBoard(request.user.id, (request.params as { id: string }).id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Brett ikke funnet." });
  });

  app.post("/api/boards/:id/duplicate", async (request, reply) => {
    const duplicated = await repository.duplicateBoard(
      request.user.id,
      (request.params as { id: string }).id
    );
    return duplicated ?? reply.code(404).send({ message: "Brett ikke funnet." });
  });
}
