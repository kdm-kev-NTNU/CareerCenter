import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import {
  CatalogInUseError,
  CompanyDuplicateError,
  InvalidReferenceError
} from "../repository.js";

const GENERIC_SERVER_MESSAGE = "Intern serverfeil.";

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ message: "Ruten ble ikke funnet." });
  });

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

    if (error instanceof CompanyDuplicateError) {
      return reply.code(409).send({ message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return reply.code(400).send({ message: "Ugyldig referanse til relatert data." });
      }
      if (error.code === "P2002") {
        return reply.code(409).send({ message: "Verdien finnes allerede." });
      }
      if (error.code === "P2025") {
        return reply.code(404).send({ message: "Ressursen ble ikke funnet." });
      }
    }

    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

    const resolvedStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
    const isServerError = resolvedStatus >= 500;
    const message =
      isServerError && env.NODE_ENV === "production"
        ? GENERIC_SERVER_MESSAGE
        : error instanceof Error
          ? error.message
          : GENERIC_SERVER_MESSAGE;

    if (isServerError) {
      app.log.error(error);
    }

    return reply.code(resolvedStatus).send({ message });
  });
}
