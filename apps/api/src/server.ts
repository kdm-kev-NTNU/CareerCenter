import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { careerTracks } from "@careercenter/shared";
import type { Repository } from "./repository.js";
import { courseSchema, pathSchema } from "./schemas.js";
import { careerMapNodes } from "./seedData.js";

export interface ServerOptions {
  repository: Repository;
  serveWeb?: boolean;
}

export function buildServer(options: ServerOptions) {
  const app = Fastify({ logger: false });
  const repository = options.repository;

  app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/career-map", async () => ({ nodes: careerMapNodes, tracks: careerTracks }));

  app.get("/api/courses", async () => repository.listCourses((await repository.getOrCreateSingleUser()).id));
  app.post("/api/courses", async (request) => repository.createCourse((await repository.getOrCreateSingleUser()).id, courseSchema.parse(request.body)));
  app.put("/api/courses/:id", async (request, reply) => {
    const result = await repository.updateCourse((await repository.getOrCreateSingleUser()).id, (request.params as { id: string }).id, courseSchema.parse(request.body));
    return result ?? reply.code(404).send({ message: "Fag ikke funnet." });
  });
  app.delete("/api/courses/:id", async (request, reply) => {
    const deleted = await repository.deleteCourse((await repository.getOrCreateSingleUser()).id, (request.params as { id: string }).id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Fag ikke funnet." });
  });

  app.get("/api/companies", async (request) => {
    const query = request.query as { q?: string; track?: string; tier?: string; geography?: string };
    return repository.listCompanies({
      q: query.q,
      track: careerTracks.includes(query.track as any) ? (query.track as any) : undefined,
      tier: query.tier ? Number(query.tier) : undefined,
      geography: query.geography
    });
  });

  app.get("/api/paths", async () => repository.listPaths((await repository.getOrCreateSingleUser()).id));
  app.get("/api/paths/:id", async (request, reply) => {
    const path = await repository.getPath((await repository.getOrCreateSingleUser()).id, (request.params as { id: string }).id);
    return path ?? reply.code(404).send({ message: "Path ikke funnet." });
  });
  app.post("/api/paths", async (request) => repository.createPath((await repository.getOrCreateSingleUser()).id, pathSchema.parse(request.body)));
  app.put("/api/paths/:id", async (request, reply) => {
    const result = await repository.updatePath((await repository.getOrCreateSingleUser()).id, (request.params as { id: string }).id, pathSchema.parse(request.body));
    return result ?? reply.code(404).send({ message: "Path ikke funnet." });
  });
  app.delete("/api/paths/:id", async (request, reply) => {
    const deleted = await repository.deletePath((await repository.getOrCreateSingleUser()).id, (request.params as { id: string }).id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Path ikke funnet." });
  });

  if (options.serveWeb) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const webDist = path.resolve(dirname, "../../../../../web/dist");
    app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
