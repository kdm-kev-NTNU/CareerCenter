import { PrismaClient } from "@prisma/client";
import { careerTrackDefaults } from "@careercenter/shared";

const prisma = new PrismaClient();

for (const track of careerTrackDefaults) {
  await prisma.careerTrackSetting.upsert({
    where: { id: track.id },
    update: { defaultLabel: track.label, sortOrder: track.sortOrder },
    create: { id: track.id, defaultLabel: track.label, label: track.label, sortOrder: track.sortOrder }
  });
}

await prisma.$disconnect();
