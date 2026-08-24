import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ensureInternshipCatalog } from "./internshipCatalog.js";
import { defaultInternshipStatuses } from "./internshipSeedData.js";

type StatusRow = { id: string; userId: string; label: string; kind: string; sortOrder: number };
type InternshipRow = { id: string; userId: string; stageIds: string[] };
type RequirementRow = { id: string; userId: string; label: string; description: string; sortOrder: number };

function createCatalogPrismaMock(
  initialStatuses: Array<Omit<StatusRow, "kind"> & { kind?: string }> = [],
  initialInternships: InternshipRow[] = [],
  initialRequirements: RequirementRow[] = []
) {
  let statuses: StatusRow[] = initialStatuses.map((status) => ({
    kind: status.kind ?? "stage",
    ...status
  }));
  let internships = [...initialInternships];
  const requirements = [...initialRequirements];
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
          where: { userId: string; kind?: string };
          orderBy?: { sortOrder: "asc" };
        }) => {
          const rows = statuses.filter((status) => {
            if (status.userId !== where.userId) return false;
            if (where.kind && status.kind !== where.kind) return false;
            return true;
          });
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
          data: Array<{ userId: string; label: string; sortOrder: number; kind?: string }>;
        }) => {
          for (const row of data) {
            statuses.push({
              id: `status-${nextId++}`,
              userId: row.userId,
              label: row.label,
              kind: row.kind ?? "stage",
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
          where: {
            userId: string;
            sortOrder?: { gte: number };
            label?: { in: string[] };
            NOT?: { kind: string };
          };
          data: { sortOrder?: { increment: number }; kind?: string };
        }) => {
          let count = 0;
          statuses = statuses.map((status) => {
            if (status.userId !== where.userId) return status;
            if (where.sortOrder && status.sortOrder < where.sortOrder.gte) return status;
            if (where.label?.in && !where.label.in.includes(status.label)) return status;
            if (where.NOT?.kind && status.kind === where.NOT.kind) return status;
            count += 1;
            return {
              ...status,
              sortOrder: data.sortOrder ? status.sortOrder + data.sortOrder.increment : status.sortOrder,
              kind: data.kind ?? status.kind
            };
          });
          return { count };
        }
      ),
      create: vi.fn(
        async ({
          data
        }: {
          data: { userId: string; label: string; sortOrder: number; kind?: string };
        }) => {
          const created = {
            id: `status-${nextId++}`,
            userId: data.userId,
            label: data.label,
            kind: data.kind ?? "stage",
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
          data: { label?: string; kind?: string };
        }) => {
          const index = statuses.findIndex((status) => status.id === where.id);
          statuses[index] = { ...statuses[index], ...data };
          return statuses[index];
        }
      )
    },
    internshipLocationOption: {
      count: vi.fn(async () => 1)
    },
    internshipRequirementType: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) =>
        requirements.filter((type) => type.userId === where.userId).length || (initialRequirements.length === 0 ? 1 : 0)
      ),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        requirements.filter((type) => type.userId === where.userId)
      ),
      create: vi.fn(
        async ({
          data
        }: {
          data: { userId: string; label: string; description: string; sortOrder: number };
        }) => {
          const created = { id: `req-${nextId++}`, ...data };
          requirements.push(created);
          return created;
        }
      )
    },
    internship: {
      findMany: vi.fn(
        async ({
          where
        }: {
          where: { userId: string; stageIds?: { isEmpty: boolean } };
        }) =>
          internships.filter((item) => {
            if (item.userId !== where.userId) return false;
            if (where.stageIds?.isEmpty) return item.stageIds.length === 0;
            return true;
          })
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { stageIds: string[] } }) => {
        internships = internships.map((item) => (item.id === where.id ? { ...item, ...data } : item));
        return internships.find((item) => item.id === where.id);
      })
    }
  };

  return {
    prisma,
    asClient: prisma as unknown as PrismaClient,
    getStatuses: (userId: string) =>
      statuses
        .filter((status) => status.userId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    getInternships: (userId: string) => internships.filter((item) => item.userId === userId)
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

const COMBINED_CASE_STATUSES = [
  "Interessert",
  "Forbereder søknad",
  "Søkt",
  "Case / online test",
  "Intervju",
  "Tilbud",
  "Avslått",
  "Trukket"
];

describe("ensureInternshipCatalog", () => {
  it("seeds all default pipeline statuses with kinds for empty catalogs", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock();

    await ensureInternshipCatalog(asClient, "user-1");

    const rows = getStatuses("user-1");
    expect(rows.map((status) => status.label)).toEqual([...defaultInternshipStatuses]);
    expect(rows.filter((status) => status.kind === "outcome").map((status) => status.label)).toEqual([
      "Tilbud",
      "Avslått",
      "Trukket"
    ]);
    expect(defaultInternshipStatuses).toContain("Online test");
    expect(defaultInternshipStatuses).toContain("Ferdig med online test");
    expect(defaultInternshipStatuses).toContain("Videosøknad");
    expect(defaultInternshipStatuses).toContain("Ferdig videosøknad");
  });

  it("inserts split pipeline statuses after Søkt for legacy catalogs", async () => {
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
    expect(labels).toEqual([...defaultInternshipStatuses]);
    expect(labels.indexOf("Online test")).toBe(labels.indexOf("Søkt") + 1);
    expect(labels.indexOf("Case")).toBe(labels.indexOf("Ferdig med online test") + 1);
    expect(labels.indexOf("Videosøknad")).toBe(labels.indexOf("Ferdig case") + 1);
  });

  it("renames Case / online test to Case and inserts missing pipeline statuses", async () => {
    const { asClient, getStatuses } = createCatalogPrismaMock(
      COMBINED_CASE_STATUSES.map((label, sortOrder) => ({
        id: `combined-${sortOrder}`,
        userId: "user-1",
        label,
        sortOrder
      }))
    );

    await ensureInternshipCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toContain("Case");
    expect(labels).not.toContain("Case / online test");
    expect(labels.filter((label) => label === "Case")).toHaveLength(1);
    expect(labels).toEqual([...defaultInternshipStatuses]);
  });

  it("does not duplicate pipeline statuses when already present", async () => {
    const { prisma, asClient, getStatuses } = createCatalogPrismaMock(
      defaultInternshipStatuses.map((label, sortOrder) => ({
        id: `current-${sortOrder}`,
        userId: "user-1",
        label,
        kind: ["Tilbud", "Avslått", "Trukket"].includes(label) ? "outcome" : "stage",
        sortOrder
      }))
    );

    await ensureInternshipCatalog(asClient, "user-1");

    const labels = getStatuses("user-1").map((status) => status.label);
    expect(labels).toEqual([...defaultInternshipStatuses]);
    expect(labels.filter((label) => label === "Case")).toHaveLength(1);
    expect(prisma.internshipStatusOption.create).not.toHaveBeenCalled();
    expect(prisma.internshipStatusOption.createMany).not.toHaveBeenCalled();
  });

  it("backfills empty internship stageIds from the stage template", async () => {
    const { asClient, getInternships } = createCatalogPrismaMock(
      defaultInternshipStatuses.map((label, sortOrder) => ({
        id: `current-${sortOrder}`,
        userId: "user-1",
        label,
        kind: ["Tilbud", "Avslått", "Trukket"].includes(label) ? "outcome" : "stage",
        sortOrder
      })),
      [{ id: "int-1", userId: "user-1", stageIds: [] }]
    );

    await ensureInternshipCatalog(asClient, "user-1");

    const [internship] = getInternships("user-1");
    expect(internship.stageIds.length).toBeGreaterThan(0);
    expect(internship.stageIds).not.toContain("current-10");
  });
});
