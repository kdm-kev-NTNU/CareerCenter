import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { hashPin } from "./auth/pin.js";
import { env } from "./config/env.js";
import { authenticate, registerAuthPlugins } from "./middleware/auth.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import type { Repository } from "./repository.js";
import { authRoutes } from "./routes/auth.js";
import { careerMapRoutes } from "./routes/careerMap.js";
import { coursesRoutes } from "./routes/courses.js";
import { healthRoutes } from "./routes/health.js";
import { graduateProgramSettingsRoutes } from "./routes/graduateProgramSettings.js";
import { graduateProgramsRoutes } from "./routes/graduatePrograms.js";
import { internshipSettingsRoutes } from "./routes/internshipSettings.js";
import { internshipsRoutes } from "./routes/internships.js";
import { bachelorStorageRoutes } from "./routes/bachelorStorage.js";
import { educationRoutes } from "./routes/education.js";
import { competitionsRoutes } from "./routes/competitions.js";
import { thesisCompaniesRoutes } from "./routes/thesisCompanies.js";
import { interviewPrepRoutes } from "./routes/interviewPrep.js";
import type { LlmClient } from "./ai/llmClient.js";
import { OpenAiLlmClient } from "./ai/openaiLlmClient.js";
import type { InterviewPrepRepository } from "./interviewPrepRepository.js";
import { InterviewPrepMemoryRepository } from "./interviewPrepMemoryRepository.js";
import { JobCancellationRegistry } from "./interview/jobCancellationRegistry.js";
import { recoverInterruptedJobs } from "./interview/recoverInterruptedJobs.js";
const TEST_AUTH_USER_NAME = "__test__";
const TEST_AUTH_USER_PIN = "0000";
const INTERVIEW_MEDIA_PERMISSIONS_POLICY = "camera=(self), microphone=(self)";

export interface ServerOptions {
  repository: Repository;
  authDisabled?: boolean;
  /** Raise in tests so lockout flows do not hit the auth rate limiter first. */
  authRateLimitMax?: number;
  llmClient?: LlmClient;
  interviewPrepRepository?: InterviewPrepRepository;
  jobCancellationRegistry?: JobCancellationRegistry;
  /** Skip restart recovery (tests that seed running jobs). */
  skipJobRecovery?: boolean;
}

function isPublicApiPath(url: string): boolean {
  return (
    url === "/api/health" ||
    url.startsWith("/api/auth/register") ||
    url.startsWith("/api/auth/login") ||
    url.startsWith("/api/auth/logout")
  );
}

export async function buildServer(options: ServerOptions) {
  const app = Fastify({ logger: env.NODE_ENV === "production" });
  const repository = options.repository;
  const authDisabled = options.authDisabled ?? env.AUTH_DISABLED;
  const llmClient = options.llmClient ?? new OpenAiLlmClient(env);
  const interviewPrepRepository = options.interviewPrepRepository ?? new InterviewPrepMemoryRepository();
  const jobCancellationRegistry = options.jobCancellationRegistry ?? new JobCancellationRegistry();

  if (!options.skipJobRecovery) {
    await recoverInterruptedJobs(interviewPrepRepository);
  }

  registerErrorHandler(app);
  await registerAuthPlugins(app);

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false
  });
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Permissions-Policy", INTERVIEW_MEDIA_PERMISSIONS_POLICY);
  });

  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? false : true,
    credentials: true
  });

  app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.get("/", async () => ({ status: "ok" }));

  app.register(healthRoutes);
  app.register((instance) =>
    authRoutes(instance, repository, { rateLimitMax: options.authRateLimitMax })
  );

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
  app.register((instance) => internshipsRoutes(instance, repository));
  app.register((instance) => internshipSettingsRoutes(instance, repository));
  app.register((instance) => graduateProgramsRoutes(instance, repository));
  app.register((instance) => graduateProgramSettingsRoutes(instance, repository));
  app.register((instance) => competitionsRoutes(instance, repository));
  app.register((instance) => thesisCompaniesRoutes(instance, repository));
  app.register((instance) => educationRoutes(instance, repository));
  app.register((instance) => bachelorStorageRoutes(instance, repository));
  app.register((instance) =>
    interviewPrepRoutes(instance, {
      llmClient,
      interviewPrepRepository,
      jobCancellationRegistry
    })
  );

  return app;
}

