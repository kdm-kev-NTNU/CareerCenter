import type { PrismaClient } from "@prisma/client";
import type { Company } from "@careercenter/shared";
import { buildDefaultBoardGraph } from "../boardGraphSeed.js";
import { careerMapNodeSeeds } from "../seedData.js";
import { ensureGraduateProgramCatalog } from "../graduateProgramCatalog.js";
import { ensureInternshipCatalog } from "../internshipCatalog.js";

export async function bootstrapNewUser(prisma: PrismaClient, userId: string) {
  await Promise.all([
    ensureInternshipCatalog(prisma, userId),
    ensureGraduateProgramCatalog(prisma, userId)
  ]);

  const existingDefault = await prisma.careerBoard.findFirst({
    where: { userId, isDefault: true }
  });
  if (existingDefault) return;

  const dbCompanies = await prisma.company.findMany();
  const companiesForGraph: Company[] = dbCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    tracks: c.tracks as Company["tracks"],
    tier: c.tier as Company["tier"],
    geography: c.geography,
    roleTypes: c.roleTypes,
    difficulty: c.difficulty as Company["difficulty"],
    upside: c.upside as Company["upside"],
    relevanceScore: c.relevanceScore,
    websiteUrl: c.websiteUrl ?? undefined
  }));

  await prisma.careerBoard.create({
    data: {
      userId,
      name: "Karrierekart",
      description: "Standard kart med bedrifter og spor",
      viewport: { x: 0, y: 0, zoom: 0.75 },
      graph: buildDefaultBoardGraph(careerMapNodeSeeds, companiesForGraph) as object,
      isDefault: true
    }
  });
}
