import type { PrismaClient } from "@prisma/client";
import {
  defaultGraduateProgramLocations,
  defaultGraduateProgramRequirementTypes,
  defaultGraduateProgramStatuses
} from "./graduateProgramSeedData.js";

export async function ensureGraduateProgramCatalog(prisma: PrismaClient, userId: string) {
  const statusCount = await prisma.graduateProgramStatusOption.count({ where: { userId } });
  if (statusCount === 0) {
    await prisma.graduateProgramStatusOption.createMany({
      data: defaultGraduateProgramStatuses.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  }

  const locationCount = await prisma.graduateProgramLocationOption.count({ where: { userId } });
  if (locationCount === 0) {
    await prisma.graduateProgramLocationOption.createMany({
      data: defaultGraduateProgramLocations.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  }

  const requirementCount = await prisma.graduateProgramRequirementType.count({ where: { userId } });
  if (requirementCount === 0) {
    await prisma.graduateProgramRequirementType.createMany({
      data: defaultGraduateProgramRequirementTypes.map((item, sortOrder) => ({
        userId,
        label: item.label,
        description: item.description,
        sortOrder
      }))
    });
  }
}
