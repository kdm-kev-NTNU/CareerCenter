import { MemoryRepository } from "./memoryRepository.js";
import { PrismaRepository } from "./prismaRepository.js";
import { buildServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const repository = process.env.CAREERCENTER_REPOSITORY === "memory" ? new MemoryRepository() : new PrismaRepository();

const app = buildServer({ repository, serveWeb: process.env.NODE_ENV === "production" });

await app.listen({ port, host: "0.0.0.0" });
