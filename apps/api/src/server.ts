import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPin } from "./auth/pin.js";
import { env } from "./config/env.js";
import { authenticate, registerAuthPlugins } from "./middleware/auth.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import type { Repository } from "./repository.js";
import { authRoutes } from "./routes/auth.js";
import { careerMapRoutes } from "./routes/careerMap.js";
import { companiesRoutes } from "./routes/companies.js";
import { coursesRoutes } from "./routes/courses.js";
import { healthRoutes } from "./routes/health.js";
import { graduateProgramSettingsRoutes } from "./routes/graduateProgramSettings.js";
import { graduateProgramsRoutes } from "./routes/graduatePrograms.js";
import { internshipSettingsRoutes } from "./routes/internshipSettings.js";
import { internshipsRoutes } from "./routes/internships.js";
import { pathsRoutes } from "./routes/paths.js";
import { bachelorStorageRoutes } from "./routes/bachelorStorage.js";
import { educationRoutes } from "./routes/education.js";
import { competitionsRoutes } from "./routes/competitions.js";
import { boardsRoutes } from "./routes/boards.js";

const TEST_AUTH_USER_NAME = "__test__";
const TEST_AUTH_USER_PIN = "0000";

export interface ServerOptions {
  repository: Repository;
  serveWeb?: boolean;
  authDisabled?: boolean;
}

function isPublicApiPath(url: string): boolean {
  return (
    url === "/api/health" ||
    url.startsWith("/api/auth/register") ||
    url.startsWith("/api/auth/login")
  );
}

export async function buildServer(options: ServerOptions) {
  const app = Fastify({ logger: env.NODE_ENV === "production" });
  const repository = options.repository;
  const authDisabled = options.authDisabled ?? env.AUTH_DISABLED;

  registerErrorHandler(app);
  await registerAuthPlugins(app);

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false
  });

  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? false : true,
    credentials: true
  });

  app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.register(healthRoutes);
  app.register((instance) => authRoutes(instance, repository));

  if (authDisabled) {
    app.addHook("onRequest", async (request) => {
      const url = request.url.split("?")[0] ?? request.url;
      if (isPublicApiPath(url)) return;

      const user = await repository.findUserByName(TEST_AUTH_USER_NAME);
      if (!user) {
        const pinHash = await hashPin(TEST_AUTH_USER_PIN);
        const created = await repository.createUser(TEST_AUTH_USER_NAME, pinHash);
        await repository.initializeNewUser(created.id);
        request.user = created;
        return;
      }
      request.user = { id: user.id, name: user.name };
    });
  } else {
    app.addHook("onRequest", async (request, reply) => {
      const url = request.url.split("?")[0] ?? request.url;
      if (!url.startsWith("/api/") || isPublicApiPath(url)) return;
      await authenticate(request, reply);
    });
  }

  app.register((instance) => careerMapRoutes(instance, repository));
  app.register((instance) => coursesRoutes(instance, repository));
  app.register((instance) => companiesRoutes(instance, repository));
  app.register((instance) => pathsRoutes(instance, repository));
  app.register((instance) => internshipsRoutes(instance, repository));
  app.register((instance) => internshipSettingsRoutes(instance, repository));
  app.register((instance) => graduateProgramsRoutes(instance, repository));
  app.register((instance) => graduateProgramSettingsRoutes(instance, repository));
  app.register((instance) => competitionsRoutes(instance, repository));
  app.register((instance) => boardsRoutes(instance, repository));
  app.register((instance) => educationRoutes(instance, repository));
  app.register((instance) => bachelorStorageRoutes(instance, repository));

  if (options.serveWeb) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const webDist = path.resolve(dirname, "../../../../../web/dist");
    app.register(fastifyStatic, { root: webDist, prefix: "/" });
    app.setNotFoundHandler((_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
