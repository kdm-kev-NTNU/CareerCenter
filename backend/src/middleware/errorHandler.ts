import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: "Ugyldig forespørsel.",
        issues: error.issues
      });
    }

    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

    const message = error instanceof Error ? error.message : "Intern serverfeil.";
    app.log.error(error);
    return reply.code(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({ message });
  });
}
