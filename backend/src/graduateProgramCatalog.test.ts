import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureGraduateProgramCatalog } from "./graduateProgramCatalog.js";
import { defaultGraduateProgramStatuses } from "./graduateProgramSeedData.js";

type StatusRow = { id: string; userId: string; label: string; sortOrder: number };

function createCatalogPrismaMock(initialStatuses: StatusRow[] = []) {
  let statuses: StatusRow[] = [...initialStatuses];
  let nextId = 1;

  const prisma = {
    graduateProgramStatusOption: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) =>
        statuses.filter((status) => status.userId === where.userId).length
      ),
      findMany: vi.fn(
        async ({
          where,
          orderBy
        }: {
          where: { userId: string };
          orderBy?: { sortOrder: "asc" };
        }) => {
          const rows = statuses.filter((status) => status.userId === where.userId);
          if (orderBy?.sortOrder === "asc") {
            return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
          }
          return rows;
        }
      ),
      createMany: vi.fn(
        async ({
          data
        }: {
          data: Array<{ userId: string; label: string; sortOrder: number }>;
        }) => {
          for (const row of data) {
            statuses.push({
              id: `status-${nextId++}`,
              userId: row.userId,
              label: row.label,
              sortOrder: row.sortOrder
            });
          }
          return { count: data.length };
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data
        }: {
          where: { userId: string; sortOrder?: { gte: number } };
          data: { sortOrder?: { increment: number } };
        }) => {
          let count = 0;
          statuses = statuses.map((status) => {
            if (status.userId !== where.userId) return status;
            if (where.sortOrder && status.sortOrder < where.sortOrder.gte) return status;
            count += 1;
            return {
              ...status,
              sortOrder: data.sortOrder ? status.sortOrder + data.sortOrder.increment : status.sortOrder
            };
          });
          return { count };
        }
      ),
      create: vi.fn(
        async ({
          data
        }: {
          data: { userId: string; label: string; sortOrder: number };
        }) => {
          const created = {
            id: `status-${nextId++}`,
            userId: data.userId,
            label: data.label,
            sortOrder: data.sortOrder
          };
          statuses.push(created);
          return created;
        }
      ),
      update: vi.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: { label?: string };
        }) => {
          const index = statuses.findIndex((status) => status.id === where.id);
          statuses[index] = { ...statuses[index], ...data };
          return statuses[index];
        }
      )
    },
    graduateProgramLocationOption: {
      count: vi.fn(async () => 1)
    },
    graduateProgramRequirementType: {
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

const LEGACY_GRADUATE_STATUSES = [
  "Interessert",
  "Forbereder søknad",
  "Søkt",
  "Case / online test",
  "Assessment center",
  "Intervju",
  "Tilbud",
  "Avslått",
  "Trukket"
];

describe("ensureGraduateProgramCatalog", () => {
  it("seeds all default statuses for empty catalogs", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock();

    await ensureGraduateProgramCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toEqual([...defaultGraduateProgramStatuses]);
    expect(defaultGraduateProgramStatuses).toContain("Intervju 1");
    expect(defaultGraduateProgramStatuses).toContain("Intervju 1 med case");
    expect(defaultGraduateProgramStatuses).toContain("Intervju 2");
    expect(defaultGraduateProgramStatuses).toContain("Intervju 2 med case");
    expect(defaultGraduateProgramStatuses).not.toContain("Intervju");
  });

  it("renames Intervju to Intervju 1 and inserts interview case variants", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock(
      LEGACY_GRADUATE_STATUSES.map((label, sortOrder) => ({
        id: `legacy-${sortOrder}`,
        userId: "user-1",
        label,
        sortOrder
      }))
    );

    await ensureGraduateProgramCatalog(asClient, "user-1");

    const statuses = getStatuses("user-1");
    const labels = statuses.map((status) => status.label);
    expect(labels).not.toContain("Intervju");
    expect(labels).toEqual([...defaultGraduateProgramStatuses]);
    expect(statuses.find((status) => status.label === "Intervju 1")?.id).toBe("legacy-5");
    expect(labels.indexOf("Intervju 1 med case")).toBe(labels.indexOf("Intervju 1") + 1);
    expect(labels.indexOf("Intervju 2")).toBe(labels.indexOf("Intervju 1 med case") + 1);
    expect(labels.indexOf("Intervju 2 med case")).toBe(labels.indexOf("Intervju 2") + 1);
  });

  it("does not duplicate statuses when already present", async () => {
    const { prisma, asClient, getStatuses } = createCatalogPrismaMock(
      defaultGraduateProgramStatuses.map((label, sortOrder) => ({
        id: `current-${sortOrder}`,
        userId: "user-1",
        label,
        sortOrder
      }))
    );

    await ensureGraduateProgramCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toEqual([...defaultGraduateProgramStatuses]);
    expect(prisma.graduateProgramStatusOption.create).not.toHaveBeenCalled();
    expect(prisma.graduateProgramStatusOption.createMany).not.toHaveBeenCalled();
  });
});
