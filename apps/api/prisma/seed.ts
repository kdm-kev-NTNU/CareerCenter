import { PrismaClient } from "@prisma/client";
import { companies } from "../src/seedData";

const prisma = new PrismaClient();

for (const company of companies) {
  await prisma.company.upsert({
    where: { name: company.name },
    update: {
      description: company.description,
      tracks: company.tracks,
      tier: company.tier,
      geography: company.geography,
      roleTypes: company.roleTypes,
      difficulty: company.difficulty,
      upside: company.upside,
      relevanceScore: company.relevanceScore,
      websiteUrl: company.websiteUrl
    },
    create: company
  });
}

await prisma.$disconnect();

