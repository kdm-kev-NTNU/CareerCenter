import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { careerTracks } from "@careercenter/shared";
import { hashPassword, requireUser, signUserToken, verifyPassword } from "./auth";
import type { Repository } from "./repository";
import { authSchema, courseSchema, pathSchema } from "./schemas";
import { careerMapNodes } from "./seedData";

export interface ServerOptions {
  repository: Repository;
  jwtSecret: string;
  serveWeb?: boolean;
}

export function buildServer(options: ServerOptions) {
  const app = Fastify({ logger: false });
  const repository = options.repository;

  app.register(cors, { origin: true });
  app.register(jwt, { secret: options.jwtSecret });

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/career-map", async () => ({ nodes: careerMapNodes, tracks: careerTracks }));

  app.post("/api/auth/register", async (request, reply) => {
    const body = authSchema.parse(request.body);
    const existing = await repository.findUserByEmail(body.email);
    if (existing) return reply.code(409).send({ message: "Brukeren finnes allerede." });
    const user = await repository.createUser({ email: body.email, passwordHash: await hashPassword(body.password) });
    return { token: signUserToken(app, user.id), user };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = authSchema.parse(request.body);
    const user = await repository.findUserByEmail(body.email);
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      return reply.code(401).send({ message: "Ugyldig e-post eller passord." });
    }
    return { token: signUserToken(app, user.id), user: { id: user.id, email: user.email } };
  });

  app.get("/api/courses", async (request) => repository.listCourses(await requireUser(request)));
  app.post("/api/courses", async (request) => repository.createCourse(await requireUser(request), courseSchema.parse(request.body)));
  app.put("/api/courses/:id", async (request, reply) => {
    const result = await repository.updateCourse(await requireUser(request), (request.params as { id: string }).id, courseSchema.parse(request.body));
    return result ?? reply.code(404).send({ message: "Fag ikke funnet." });
  });
  app.delete("/api/courses/:id", async (request, reply) => {
    const deleted = await repository.deleteCourse(await requireUser(request), (request.params as { id: string }).id);
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

  app.get("/api/paths", async (request) => repository.listPaths(await requireUser(request)));
  app.get("/api/paths/:id", async (request, reply) => {
    const path = await repository.getPath(await requireUser(request), (request.params as { id: string }).id);
    return path ?? reply.code(404).send({ message: "Path ikke funnet." });
  });
  app.post("/api/paths", async (request) => repository.createPath(await requireUser(request), pathSchema.parse(request.body)));
  app.put("/api/paths/:id", async (request, reply) => {
    const result = await repository.updatePath(await requireUser(request), (request.params as { id: string }).id, pathSchema.parse(request.body));
    return result ?? reply.code(404).send({ message: "Path ikke funnet." });
  });
  app.delete("/api/paths/:id", async (request, reply) => {
    const deleted = await repository.deletePath(await requireUser(request), (request.params as { id: string }).id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Path ikke funnet." });
  });

  if (options.serveWeb) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const webDist = path.resolve(dirname, "../../web/dist");
    app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}

