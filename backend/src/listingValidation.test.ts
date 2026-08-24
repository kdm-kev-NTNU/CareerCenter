import { describe, expect, it } from "vitest";
import { InvalidReferenceError } from "./repository.js";
import { validateListingInput } from "./listingValidation.js";

const settings = {
  statuses: [{ id: "status-1" }],
  locations: [{ id: "loc-1" }],
  requirementTypes: [{ id: "req-1" }]
};

describe("validateListingInput", () => {
  it("returns input when all references are valid", async () => {
    const input = {
      statusId: "status-1",
      locationIds: ["loc-1"],
      requirements: [{ requirementTypeId: "req-1", isRequired: true, isDone: false, notes: "" }]
    };
    await expect(validateListingInput(input, settings)).resolves.toEqual(input);
  });

  it("rejects invalid statusId", async () => {
    await expect(
      validateListingInput({ statusId: "missing", locationIds: [], requirements: [] }, settings)
    ).rejects.toThrow(new InvalidReferenceError("Ugyldig status."));
  });

  it("rejects invalid locationId", async () => {
    await expect(
      validateListingInput({ statusId: "status-1", locationIds: ["missing"], requirements: [] }, settings)
    ).rejects.toThrow(new InvalidReferenceError("Ugyldig sted."));
  });

  it("rejects invalid requirementTypeId", async () => {
    await expect(
      validateListingInput(
        {
          statusId: "status-1",
          locationIds: [],
          requirements: [{ requirementTypeId: "missing", isRequired: true, isDone: false, notes: "" }]
        },
        settings
      )
    ).rejects.toThrow(new InvalidReferenceError("Ugyldig kravtype."));
  });

  it("rejects empty stageIds when a flow is provided", async () => {
    await expect(
      validateListingInput({ statusId: "status-1", locationIds: [], requirements: [], stageIds: [] }, settings)
    ).rejects.toThrow(new InvalidReferenceError("Søknadsflyt må ha minst ett steg."));
  });

  it("rejects duplicate, outcome, and unknown stage ids", async () => {
    const pipelineSettings = {
      statuses: [
        { id: "status-1", kind: "stage" as const },
        { id: "status-2", kind: "stage" as const },
        { id: "offer", kind: "outcome" as const }
      ],
      locations: [{ id: "loc-1" }],
      requirementTypes: [{ id: "req-1" }]
    };

    await expect(
      validateListingInput(
        { statusId: "status-1", locationIds: [], requirements: [], stageIds: ["status-1", "status-1"] },
        pipelineSettings
      )
    ).rejects.toThrow(new InvalidReferenceError("Duplikat i søknadsflyt."));

    await expect(
      validateListingInput(
        { statusId: "status-1", locationIds: [], requirements: [], stageIds: ["status-1", "offer"] },
        pipelineSettings
      )
    ).rejects.toThrow(new InvalidReferenceError("Utfall kan ikke inngå i søknadsflyten."));

    await expect(
      validateListingInput(
        { statusId: "status-1", locationIds: [], requirements: [], stageIds: ["missing"] },
        pipelineSettings
      )
    ).rejects.toThrow(new InvalidReferenceError("Ugyldig steg i flyt."));
  });

  it("requires a current stage to belong to the internship flow", async () => {
    const pipelineSettings = {
      statuses: [
        { id: "status-1", kind: "stage" as const },
        { id: "status-2", kind: "stage" as const },
        { id: "offer", kind: "outcome" as const }
      ],
      locations: [],
      requirementTypes: []
    };

    await expect(
      validateListingInput(
        { statusId: "status-2", locationIds: [], requirements: [], stageIds: ["status-1"] },
        pipelineSettings
      )
    ).rejects.toThrow(new InvalidReferenceError("Statusen må inngå i søknadsflyten."));

    await expect(
      validateListingInput(
        { statusId: "offer", locationIds: [], requirements: [], stageIds: ["status-1"] },
        pipelineSettings
      )
    ).resolves.toMatchObject({ statusId: "offer", stageIds: ["status-1"] });
  });
});
