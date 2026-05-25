import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { CatalogInUseError, InvalidReferenceError } from "../repository.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Ugyldig forespørsel.",
        issues: error.issues
      });
    }

    if (error instanceof InvalidReferenceError) {
      return reply.code(422).send({ message: error.message });
    }

    if (error instanceof CatalogInUseError) {
      return reply.code(409).send({ message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return reply.code(400).send({ message: "Ugyldig referanse til relatert data." });
      }
      if (error.code === "P2002") {
        return reply.code(409).send({ message: "Verdien finnes allerede." });
      }
    }

    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

    const message = error instanceof Error ? error.message : "Intern serverfeil.";
    app.log.error(error);
    return reply.code(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({ message });
  });
}
