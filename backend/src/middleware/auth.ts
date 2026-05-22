import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AUTH_COOKIE_NAME } from "../auth/constants.js";
import { env } from "../config/env.js";

const JWT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export async function registerAuthPlugins(app: FastifyInstance) {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: AUTH_COOKIE_NAME,
      signed: false
    }
  });
}

export function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: JWT_MAX_AGE_SECONDS
  });
}

export function clearAuthCookie(reply: FastifyReply) {
  reply.clearCookie(AUTH_COOKIE_NAME, {
    path: "/",
    secure: env.NODE_ENV === "production",
    sameSite: "strict"
  });
}

export async function signAuthToken(
  app: FastifyInstance,
  user: { id: string; name: string }
): Promise<string> {
  return app.jwt.sign({ id: user.id, name: user.name }, { expiresIn: `${JWT_MAX_AGE_SECONDS}s` });
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.cookies[AUTH_COOKIE_NAME];
    if (!token) {
      return reply.code(401).send({ message: "Ikke autentisert." });
    }
    const payload = await request.server.jwt.verify<{ id: string; name: string }>(token);
    request.user = payload;
  } catch {
    return reply.code(401).send({ message: "Ugyldig eller utløpt sesjon." });
  }
}
