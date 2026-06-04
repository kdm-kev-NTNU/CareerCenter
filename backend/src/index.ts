import { env } from "./config/env.js";
import { MemoryRepository } from "./memoryRepository.js";
import { PrismaRepository } from "./prismaRepository.js";
import { buildServer } from "./server.js";

const repository =
  process.env.CAREERCENTER_REPOSITORY === "memory" || env.CAREERCENTER_REPOSITORY === "memory"
    ? new MemoryRepository()
    : new PrismaRepository();

const app = await buildServer({ repository });

async function shutdown(signal: string) {
  app.log.info(`Mottok ${signal}, avslutter...`);
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: env.PORT, host: "::" });
