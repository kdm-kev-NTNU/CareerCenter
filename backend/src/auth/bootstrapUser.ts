import type { PrismaClient } from "@prisma/client";
import { ensureGraduateProgramCatalog } from "../graduateProgramCatalog.js";
import { ensureInterviewBibleCatalog } from "../interview/bibleCatalog.js";
import { ensureInternshipCatalog } from "../internshipCatalog.js";

export async function bootstrapNewUser(prisma: PrismaClient, userId: string) {
  await Promise.all([
    ensureInternshipCatalog(prisma, userId),
    ensureGraduateProgramCatalog(prisma, userId),
    ensureInterviewBibleCatalog(prisma, userId)
  ]);
}
