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

});
