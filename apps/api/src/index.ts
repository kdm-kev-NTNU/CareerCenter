import { MemoryRepository } from "./memoryRepository";
import { PrismaRepository } from "./prismaRepository";
import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET ?? "local-dev-secret";
const repository = process.env.CAREERCENTER_REPOSITORY === "memory" ? new MemoryRepository() : new PrismaRepository();

const app = buildServer({ repository, jwtSecret, serveWeb: process.env.NODE_ENV === "production" });

await app.listen({ port, host: "0.0.0.0" });

