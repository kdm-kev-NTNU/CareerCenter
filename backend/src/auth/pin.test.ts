import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./pin.js";

describe("pin helpers", () => {
  it("hashes and verifies a pin", async () => {
    const hash = await hashPin("1234");
    expect(hash).not.toBe("1234");
    await expect(verifyPin("1234", hash)).resolves.toBe(true);
    await expect(verifyPin("9999", hash)).resolves.toBe(false);
  });
});
