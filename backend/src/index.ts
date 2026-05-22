import { env } from "./config/env.js";
import { MemoryRepository } from "./memoryRepository.js";
import { PrismaRepository } from "./prismaRepository.js";
import { buildServer } from "./server.js";

const repository =
  process.env.CAREERCENTER_REPOSITORY === "memory" || env.CAREERCENTER_REPOSITORY === "memory"
    ? new MemoryRepository()
    : new PrismaRepository();

const app = await buildServer({ repository });

await app.listen({ port: env.PORT, host: "0.0.0.0" });
