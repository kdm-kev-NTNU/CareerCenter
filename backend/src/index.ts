import { PrismaClient } from "@prisma/client";
import { env } from "./config/env.js";
import { MemoryRepository } from "./memoryRepository.js";
import { PrismaRepository } from "./prismaRepository.js";
import { InterviewPrepMemoryRepository } from "./interviewPrepMemoryRepository.js";
import { InterviewPrepPrismaRepository } from "./interviewPrepPrismaRepository.js";
import { buildServer } from "./server.js";

const useMemoryRepository =
  process.env.CAREERCENTER_REPOSITORY === "memory" || env.CAREERCENTER_REPOSITORY === "memory";

const repository = useMemoryRepository ? new MemoryRepository() : new PrismaRepository();
const interviewPrepRepository = useMemoryRepository
  ? new InterviewPrepMemoryRepository()
  : new InterviewPrepPrismaRepository(new PrismaClient());

const app = await buildServer({ repository, interviewPrepRepository });

async function shutdown(signal: string) {
  app.log.info(`Mottok ${signal}, avslutter...`);
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: env.PORT, host: "::" });
