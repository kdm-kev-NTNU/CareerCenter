import { PrismaClient } from "@prisma/client";
import { careerTrackDefaults } from "@careercenter/shared";
import { companies, careerMapNodeSeeds } from "../src/seedData.js";
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

for (const track of careerTrackDefaults) {
  await prisma.careerTrackSetting.upsert({
    where: { id: track.id },
    update: { defaultLabel: track.label, sortOrder: track.sortOrder },
    create: { id: track.id, defaultLabel: track.label, label: track.label, sortOrder: track.sortOrder }
  });
}

for (const node of careerMapNodeSeeds) {
  await prisma.careerMapNode.upsert({
    where: { id: node.id },
    update: {
      defaultTitle: node.defaultTitle,
      defaultItems: node.defaultItems,
      level: node.level,
      trackId: node.track ?? null,
      sortOrder: node.sortOrder
    },
    create: {
      id: node.id,
      defaultTitle: node.defaultTitle,
      title: node.title,
      defaultItems: node.defaultItems,
      items: node.items,
      level: node.level,
      trackId: node.track ?? null,
      sortOrder: node.sortOrder
    }
  });
}

await prisma.$disconnect();
