import { describe, expect, it } from "vitest";
import { useListingExpand } from "./useListingExpand.js";

describe("useListingExpand", () => {
  it("expands, collapses, and toggles listing rows", () => {
    const { expandedId, toggleExpand, isExpanded, collapse } = useListingExpand();

    expect(expandedId.value).toBeNull();
    expect(isExpanded("row-1")).toBe(false);

    toggleExpand("row-1");
    expect(expandedId.value).toBe("row-1");
    expect(isExpanded("row-1")).toBe(true);
    expect(isExpanded("row-2")).toBe(false);

    toggleExpand("row-1");
    expect(expandedId.value).toBeNull();

    toggleExpand("row-2");
    toggleExpand("row-3");
    expect(expandedId.value).toBe("row-3");

    collapse();
    expect(expandedId.value).toBeNull();
  });
});
