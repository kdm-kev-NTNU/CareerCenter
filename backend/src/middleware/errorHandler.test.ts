import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { registerErrorHandler } from "./errorHandler.js";
import { CatalogInUseError, InvalidReferenceError } from "../repository.js";

async function createApp() {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.get("/zod", async () => {
    z.object({ name: z.string().min(1) }).parse({ name: "" });
  });
  app.get("/invalid-ref", async () => {
    throw new InvalidReferenceError("Ugyldig status.");
  });
  app.get("/catalog-in-use", async () => {
    throw new CatalogInUseError("I bruk.");
  });
  app.get("/prisma-fk", async () => {
    throw new Prisma.PrismaClientKnownRequestError("FK", {
      code: "P2003",
      clientVersion: "test",
      meta: {}
    });
  });
  app.get("/prisma-unique", async () => {
    throw new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: {}
    });
  });
  app.get("/prisma-missing", async () => {
    throw new Prisma.PrismaClientKnownRequestError("Missing", {
      code: "P2025",
      clientVersion: "test",
      meta: {}
    });
  });
  app.get("/boom", async () => {
    throw new Error("boom");
  });
  await app.ready();
  return app;
}

describe("registerErrorHandler", () => {
  it("returns 404 for unknown routes", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: "Ruten ble ikke funnet." });
    await app.close();
  }, 10000);

  it("maps ZodError to 400 with issues", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/zod" });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Ugyldig forespørsel.");
    expect(response.json().issues).toBeDefined();
    await app.close();
  });

  it("maps domain errors to expected status codes", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "GET", url: "/invalid-ref" })).statusCode).toBe(422);
    expect((await app.inject({ method: "GET", url: "/catalog-in-use" })).statusCode).toBe(409);
    await app.close();
  });

  it("maps Prisma errors to HTTP responses", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "GET", url: "/prisma-fk" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/prisma-unique" })).statusCode).toBe(409);
    expect((await app.inject({ method: "GET", url: "/prisma-missing" })).statusCode).toBe(404);
    await app.close();
  });

  it("maps unexpected errors to 500", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/boom" });
    expect(response.statusCode).toBe(500);
    expect(response.json().message).toBe("boom");
    await app.close();
  });
});
