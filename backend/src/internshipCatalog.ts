import type { PrismaClient } from "@prisma/client";
import {
  defaultInternshipLocations,
  defaultInternshipRequirementTypes,
  defaultInternshipStatuses
} from "./internshipSeedData.js";

export async function ensureInternshipCatalog(prisma: PrismaClient, userId: string) {
  const statusCount = await prisma.internshipStatusOption.count({ where: { userId } });
  if (statusCount === 0) {
    await prisma.internshipStatusOption.createMany({
      data: defaultInternshipStatuses.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  }

  const locationCount = await prisma.internshipLocationOption.count({ where: { userId } });
  if (locationCount === 0) {
    await prisma.internshipLocationOption.createMany({
      data: defaultInternshipLocations.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  }

  const requirementCount = await prisma.internshipRequirementType.count({ where: { userId } });
  if (requirementCount === 0) {
    await prisma.internshipRequirementType.createMany({
      data: defaultInternshipRequirementTypes.map((item, sortOrder) => ({
        userId,
        label: item.label,
        description: item.description,
        sortOrder
      }))
    });
  }
}
