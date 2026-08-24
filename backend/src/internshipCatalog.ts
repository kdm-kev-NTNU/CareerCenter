import type { PrismaClient } from "@prisma/client";
import {
  defaultInternshipLocations,
  defaultInternshipRequirementTypes,
  defaultInternshipStatuses,
  internshipStatusKind
} from "./internshipSeedData.js";

const LEGACY_COMBINED_STATUS_LABEL = "Case / online test";
const CASE_STATUS_LABEL = "Case";

async function renameLegacyCombinedStatus(prisma: PrismaClient, userId: string) {
  const existing = await prisma.internshipStatusOption.findMany({ where: { userId } });
  const combined = existing.find((status) => status.label === LEGACY_COMBINED_STATUS_LABEL);
  if (!combined) return;
  if (existing.some((status) => status.label === CASE_STATUS_LABEL)) return;

  await prisma.internshipStatusOption.update({
    where: { id: combined.id },
    data: { label: CASE_STATUS_LABEL }
  });
}

async function ensureInternshipStatusKinds(prisma: PrismaClient, userId: string) {
  await prisma.internshipStatusOption.updateMany({
    where: {
      userId,
      label: { in: ["Tilbud", "Avslått", "Trukket"] },
      NOT: { kind: "outcome" }
    },
    data: { kind: "outcome" }
  });
}

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
      data: { userId, label, sortOrder: insertOrder, kind: internshipStatusKind(label) }
    });
    byLabel.set(label, created);

    for (const status of byLabel.values()) {
      if (status.id !== created.id && status.sortOrder >= insertOrder) {
        status.sortOrder += 1;
      }
    }
  }
}

async function ensureMissingInternshipRequirementTypes(prisma: PrismaClient, userId: string) {
  const existing = await prisma.internshipRequirementType.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" }
  });
  if (existing.length === 0) {
    return;
  }

  const labels = new Set(existing.map((type) => type.label));
  let nextOrder = Math.max(...existing.map((type) => type.sortOrder), -1) + 1;
  for (const item of defaultInternshipRequirementTypes) {
    if (labels.has(item.label)) continue;
    await prisma.internshipRequirementType.create({
      data: {
        userId,
        label: item.label,
        description: item.description,
        sortOrder: nextOrder
      }
    });
    nextOrder += 1;
  }
}

async function backfillEmptyInternshipStageIds(prisma: PrismaClient, userId: string) {
  const stages = await prisma.internshipStatusOption.findMany({
    where: { userId, kind: "stage" },
    orderBy: { sortOrder: "asc" }
  });
  const stageIds = stages.map((status) => status.id);
  if (stageIds.length === 0) return;

  const internships = await prisma.internship.findMany({
    where: { userId, stageIds: { isEmpty: true } },
    select: { id: true }
  });

  for (const internship of internships) {
    await prisma.internship.update({
      where: { id: internship.id },
      data: { stageIds }
    });
  }
}

export async function ensureInternshipCatalog(prisma: PrismaClient, userId: string) {
  const statusCount = await prisma.internshipStatusOption.count({ where: { userId } });
  if (statusCount === 0) {
    await prisma.internshipStatusOption.createMany({
      data: defaultInternshipStatuses.map((label, sortOrder) => ({
        userId,
        label,
        sortOrder,
        kind: internshipStatusKind(label)
      }))
    });
  } else {
    await renameLegacyCombinedStatus(prisma, userId);
    await ensureInternshipStatusKinds(prisma, userId);
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
  } else {
    await ensureMissingInternshipRequirementTypes(prisma, userId);
  }

  await backfillEmptyInternshipStageIds(prisma, userId);
}
