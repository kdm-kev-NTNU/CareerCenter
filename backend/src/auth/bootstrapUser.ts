import type { PrismaClient } from "@prisma/client";
import { ensureGraduateProgramCatalog } from "../graduateProgramCatalog.js";
import { ensureInternshipCatalog } from "../internshipCatalog.js";

export async function bootstrapNewUser(prisma: PrismaClient, userId: string) {
  await Promise.all([
    ensureInternshipCatalog(prisma, userId),
    ensureGraduateProgramCatalog(prisma, userId)
  ]);
}
