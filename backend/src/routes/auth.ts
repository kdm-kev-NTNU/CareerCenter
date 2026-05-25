import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from "../auth/constants.js";
import { hashPin, verifyPin } from "../auth/pin.js";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../middleware/auth.js";
import type { Repository } from "../repository.js";
import { authCredentialsSchema } from "../schemas.js";

function isLocked(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

export async function authRoutes(
  app: FastifyInstance,
  repository: Repository,
  options: { rateLimitMax?: number } = {}
) {
  app.get("/api/auth/me", async (request, reply) => {
    const profile = await repository.getUserById(request.user.id);
    if (!profile) {
      return reply.code(401).send({ message: "Ikke autentisert." });
    }
    return profile;
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return reply.code(204).send();
  });

  await app.register(async (rateLimited) => {
    await rateLimited.register(rateLimit, {
      max: options.rateLimitMax ?? 5,
      timeWindow: "1 minute"
    });

    rateLimited.post("/api/auth/register", async (request, reply) => {
      const { name, pin } = authCredentialsSchema.parse(request.body);
      const existing = await repository.findUserByName(name);
      if (existing) {
        return reply.code(409).send({ message: "Brukernavnet er allerede tatt." });
      }

      const pinHash = await hashPin(pin);
      const user = await repository.createUser(name, pinHash);

      await repository.initializeNewUser(user.id);

      const token = await signAuthToken(app, user);
      setAuthCookie(reply, token);
      return reply.code(201).send(user);
    });

    rateLimited.post("/api/auth/login", async (request, reply) => {
      const { name, pin } = authCredentialsSchema.parse(request.body);
      const user = await repository.findUserByName(name);
      if (!user) {
        return reply.code(401).send({ message: "Feil navn eller pinkode." });
      }

      if (isLocked(user.lockedUntil)) {
        return reply.code(423).send({
          message: "Kontoen er midlertidig låst. Prøv igjen senere.",
          lockedUntil: user.lockedUntil?.toISOString()
        });
      }

      const valid = await verifyPin(pin, user.pinHash);
      if (!valid) {
        const updated = await repository.incrementFailedAttempts(user.id);
        if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
          await repository.lockUser(user.id, until);
          return reply.code(423).send({
            message: `For mange feil forsøk. Kontoen er låst i ${LOCKOUT_MINUTES} minutter.`,
            lockedUntil: until.toISOString()
          });
        }
        return reply.code(401).send({ message: "Feil navn eller pinkode." });
      }

      await repository.resetFailedAttempts(user.id);
      const token = await signAuthToken(app, { id: user.id, name: user.name });
      setAuthCookie(reply, token);
      return { id: user.id, name: user.name };
    });
  });
}
