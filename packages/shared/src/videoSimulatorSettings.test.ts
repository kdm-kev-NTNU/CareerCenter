import { describe, expect, it } from "vitest";
import { defaultVideoSimulatorSettings, videoSimulatorSettingsSchema } from "./videoSimulatorSettings.js";

describe("videoSimulatorSettingsSchema", () => {
  it("applies defaults", () => {
    const parsed = videoSimulatorSettingsSchema.parse({});
    expect(parsed.thinkSeconds).toBe(30);
    expect(parsed.answerSeconds).toBe(90);
    expect(parsed.prompts.length).toBeGreaterThan(0);
  });

  it("matches bundled defaults", () => {
    expect(videoSimulatorSettingsSchema.parse(defaultVideoSimulatorSettings)).toEqual(
      defaultVideoSimulatorSettings
    );
  });
});
