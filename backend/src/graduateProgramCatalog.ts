import type { PrismaClient } from "@prisma/client";
import {
  defaultGraduateProgramLocations,
  defaultGraduateProgramRequirementTypes,
  defaultGraduateProgramStatuses
} from "./graduateProgramSeedData.js";

const LEGACY_INTERVIEW_STATUS_LABEL = "Intervju";
const INTERVIEW_1_STATUS_LABEL = "Intervju 1";

async function renameLegacyInterviewStatus(prisma: PrismaClient, userId: string) {
  const existing = await prisma.graduateProgramStatusOption.findMany({ where: { userId } });
  const legacy = existing.find((status) => status.label === LEGACY_INTERVIEW_STATUS_LABEL);
  if (!legacy) return;
  if (existing.some((status) => status.label === INTERVIEW_1_STATUS_LABEL)) return;

  await prisma.graduateProgramStatusOption.update({
    where: { id: legacy.id },
    data: { label: INTERVIEW_1_STATUS_LABEL }
  });
}

async function ensureMissingGraduateProgramStatuses(prisma: PrismaClient, userId: string) {
  const existing = await prisma.graduateProgramStatusOption.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" }
  });
  if (existing.length === 0) {
    return;
  }

  const byLabel = new Map(existing.map((status) => [status.label, status]));

  for (let defaultIndex = 0; defaultIndex < defaultGraduateProgramStatuses.length; defaultIndex++) {
    const label = defaultGraduateProgramStatuses[defaultIndex];
    if (byLabel.has(label)) {
      continue;
    }

    let insertOrder: number | null = null;

    for (let i = defaultIndex - 1; i >= 0; i--) {
      const previous = byLabel.get(defaultGraduateProgramStatuses[i]);
      if (previous) {
        insertOrder = previous.sortOrder + 1;
        break;
      }
    }

    if (insertOrder === null) {
      for (let i = defaultIndex + 1; i < defaultGraduateProgramStatuses.length; i++) {
        const next = byLabel.get(defaultGraduateProgramStatuses[i]);
        if (next) {
          insertOrder = next.sortOrder;
          break;
        }
      }
    }

    if (insertOrder === null) {
      insertOrder = Math.max(...[...byLabel.values()].map((status) => status.sortOrder), -1) + 1;
    }

    await prisma.graduateProgramStatusOption.updateMany({
      where: { userId, sortOrder: { gte: insertOrder } },
      data: { sortOrder: { increment: 1 } }
    });

    const created = await prisma.graduateProgramStatusOption.create({
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

export async function ensureGraduateProgramCatalog(prisma: PrismaClient, userId: string) {
  const statusCount = await prisma.graduateProgramStatusOption.count({ where: { userId } });
  if (statusCount === 0) {
    await prisma.graduateProgramStatusOption.createMany({
      data: defaultGraduateProgramStatuses.map((label, sortOrder) => ({ userId, label, sortOrder }))
    });
  } else {
    await renameLegacyInterviewStatus(prisma, userId);
    await ensureMissingGraduateProgramStatuses(prisma, userId);
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
