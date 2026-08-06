import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureInternshipCatalog } from "./internshipCatalog.js";
import { defaultInternshipStatuses } from "./internshipSeedData.js";

type StatusRow = { id: string; userId: string; label: string; sortOrder: number };

function createCatalogPrismaMock(initialStatuses: StatusRow[] = []) {
  let statuses = [...initialStatuses];
  let nextId = 1;

  const prisma = {
    internshipStatusOption: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) =>
        statuses.filter((status) => status.userId === where.userId).length
      ),
      findMany: vi.fn(
        async ({
          where,
          orderBy
        }: {
          where: { userId: string };
          orderBy: { sortOrder: "asc" };
        }) => {
          const rows = statuses.filter((status) => status.userId === where.userId);
          if (orderBy.sortOrder === "asc") {
            return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
          }
          return rows;
        }
      ),
      createMany: vi.fn(async ({ data }: { data: Array<{ userId: string; label: string; sortOrder: number }> }) => {
        for (const row of data) {
          statuses.push({ id: `status-${nextId++}`, ...row });
        }
        return { count: data.length };
      }),
      updateMany: vi.fn(
        async ({
          where,
          data
        }: {
          where: { userId: string; sortOrder: { gte: number } };
          data: { sortOrder: { increment: number } };
        }) => {
          let count = 0;
          statuses = statuses.map((status) => {
            if (status.userId === where.userId && status.sortOrder >= where.sortOrder.gte) {
              count += 1;
              return { ...status, sortOrder: status.sortOrder + data.sortOrder.increment };
            }
            return status;
          });
          return { count };
        }
      ),
      create: vi.fn(async ({ data }: { data: { userId: string; label: string; sortOrder: number } }) => {
        const created = { id: `status-${nextId++}`, ...data };
        statuses.push(created);
        return created;
      })
    },
    internshipLocationOption: {
      count: vi.fn(async () => 1)
    },
    internshipRequirementType: {
      count: vi.fn(async () => 1)
    }
  };

  return {
    prisma,
    asClient: prisma as unknown as PrismaClient,
    getStatuses: (userId: string) =>
      statuses
        .filter((status) => status.userId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

const OLD_DEFAULT_STATUSES = [
  "Interessert",
  "Forbereder søknad",
  "Søkt",
  "Intervju",
  "Tilbud",
  "Avslått",
  "Trukket"
];

describe("ensureInternshipCatalog", () => {
  it("seeds all default statuses including Case / online test for empty catalogs", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock();

    await ensureInternshipCatalog(asClient, "user-1");

    expect(getStatuses("user-1").map((status) => status.label)).toEqual(defaultInternshipStatuses);
    expect(defaultInternshipStatuses).toContain("Case / online test");
  });

  it("inserts Case / online test after Søkt for legacy catalogs", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock(
      OLD_DEFAULT_STATUSES.map((label, sortOrder) => ({
        id: `old-${sortOrder}`,
        userId: "user-1",
        label,
        sortOrder
      }))
    );

    await ensureInternshipCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toEqual(defaultInternshipStatuses);
    expect(labels.indexOf("Case / online test")).toBe(labels.indexOf("Søkt") + 1);
  });

  it("does not duplicate Case / online test when already present", async () => {
    const { prisma, asClient, getStatuses } = createCatalogPrismaMock(
      defaultInternshipStatuses.map((label, sortOrder) => ({
        id: `current-${sortOrder}`,
        userId: "user-1",
        label,
        sortOrder
      }))
    );

    await ensureInternshipCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toEqual(defaultInternshipStatuses);
    expect(labels.filter((label) => label === "Case / online test")).toHaveLength(1);
    expect(prisma.internshipStatusOption.create).not.toHaveBeenCalled();
    expect(prisma.internshipStatusOption.createMany).not.toHaveBeenCalled();
  });
});
