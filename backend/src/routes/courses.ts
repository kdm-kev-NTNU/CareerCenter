import type { FastifyInstance } from "fastify";
import type { Repository } from "../repository.js";
import { courseSchema } from "../schemas.js";

export async function coursesRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/courses", async (request) => repository.listCourses(request.user.id));

  app.post("/api/courses", async (request) =>
    repository.createCourse(request.user.id, courseSchema.parse(request.body))
  );

  app.put("/api/courses/:id", async (request, reply) => {
    const result = await repository.updateCourse(
      request.user.id,
      (request.params as { id: string }).id,
      courseSchema.parse(request.body)
    );
    return result ?? reply.code(404).send({ message: "Fag ikke funnet." });
  });

  app.delete("/api/courses/:id", async (request, reply) => {
    const deleted = await repository.deleteCourse(
      request.user.id,
      (request.params as { id: string }).id
    );
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Fag ikke funnet." });
  });
}
