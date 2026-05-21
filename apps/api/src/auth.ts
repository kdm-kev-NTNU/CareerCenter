import argon2 from "argon2";
import type { FastifyInstance, FastifyRequest } from "fastify";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function requireUser(request: FastifyRequest): Promise<string> {
  await request.jwtVerify();
  const payload = request.user as { sub?: string };
  if (!payload.sub) {
    throw new Error("Unauthorized");
  }
  return payload.sub;
}

export function signUserToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign({ sub: userId });
}

