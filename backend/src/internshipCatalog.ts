import type { PrismaClient } from "@prisma/client";
import {
  defaultInternshipLocations,
  defaultInternshipRequirementTypes,
  defaultInternshipStatuses
} from "./internshipSeedData.js";

async function ensureMissingInternshipStatuses(prisma: PrismaClient, userId: string) {
  const existing = await prisma.internshipStatusOption.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" }
  });
  if (existing.length === 0) {
    return;
  }

  const byLabel = new Map(existing.map((status) => [status.label, status]));

  for (let defaultIndex = 0; defaultIndex < defaultInternshipStatuses.length; defaultIndex++) {
    const label = defaultInternshipStatuses[defaultIndex];
    if (byLabel.has(label)) {
      continue;
    }

    let insertOrder: number | null = null;

    for (let i = defaultIndex - 1; i >= 0; i--) {
      const previous = byLabel.get(defaultInternshipStatuses[i]);
      if (previous) {
        insertOrder = previous.sortOrder + 1;
        break;
      }
    }

    if (insertOrder === null) {
      for (let i = defaultIndex + 1; i < defaultInternshipStatuses.length; i++) {
        const next = byLabel.get(defaultInternshipStatuses[i]);
        if (next) {
          insertOrder = next.sortOrder;
          break;
        }
      }
    }

    if (insertOrder === null) {
      insertOrder = Math.max(...[...byLabel.values()].map((status) => status.sortOrder), -1) + 1;
    }

    await prisma.internshipStatusOption.updateMany({
      where: { userId, sortOrder: { gte: insertOrder } },
      data: { sortOrder: { increment: 1 } }
    });

    const created = await prisma.internshipStatusOption.create({
      data: { userId, label, sortOrder: insertOrder }
    });
    byLabel.set(label, created);

    for (const status of byLabel.values()) {
      if (status.id !== created.id && status.sortOrder >= insertOrder) {
        status.sortOrder += 1;
      }
    }
  }
}

export async function ensureInternshipCatalog(prisma: PrismaClient, userId: string) {
  const statusCount = await prisma.internshipStatusOption.count({ where: { userId } });
  if (statusCount === 0) {
    await prisma.internshipStatusOption.createMany({
      data: defaultInternshipStatuses.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  } else {
    await ensureMissingInternshipStatuses(prisma, userId);
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
