import { PrismaClient } from "@prisma/client";
import { companies } from "../src/seedData.js";
import { SINGLE_USER_EMAIL } from "../src/repository.js";

const prisma = new PrismaClient();

await prisma.user.upsert({
  where: { email: SINGLE_USER_EMAIL },
  update: {},
  create: {
    email: SINGLE_USER_EMAIL,
    passwordHash: "single-user-no-login"
  }
});

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
