import { describe, expect, it } from "vitest";
import {
  defaultVideoSimulatorSettings,
  videoQuestionRequestSchema,
  videoSimulatorSettingsSchema
} from "./videoSimulatorSettings.js";

describe("videoSimulatorSettingsSchema", () => {
  it("applies defaults including questionCount", () => {
    const parsed = videoSimulatorSettingsSchema.parse({});
    expect(parsed.thinkSeconds).toBe(30);
    expect(parsed.answerSeconds).toBe(90);
    expect(parsed.questionCount).toBe(3);
    expect(parsed.ratingModel).toBe("gpt-6-astra");
  });

  it("keeps an explicit rating model", () => {
    const parsed = videoSimulatorSettingsSchema.parse({ ratingModel: "gpt-6-luna" });
    expect(parsed.ratingModel).toBe("gpt-6-luna");
  });

  it("matches bundled defaults", () => {
    expect(videoSimulatorSettingsSchema.parse(defaultVideoSimulatorSettings)).toEqual(
      defaultVideoSimulatorSettings
    );
  });

  it("parses legacy payloads that still include prompts", () => {
    const parsed = videoSimulatorSettingsSchema.parse({
      thinkSeconds: 45,
      answerSeconds: 120,
      prompts: ["Gammel prompt 1", "Gammel prompt 2"],
      ratingModel: "gpt-6-luna"
    });
    expect(parsed).toEqual({
      thinkSeconds: 45,
      answerSeconds: 120,
      questionCount: 3,
      ratingModel: "gpt-6-luna"
    });
    expect("prompts" in parsed).toBe(false);
  });

  it("rejects questionCount outside 1–10", () => {
    expect(() => videoSimulatorSettingsSchema.parse({ questionCount: 0 })).toThrow();
    expect(() => videoSimulatorSettingsSchema.parse({ questionCount: 11 })).toThrow();
  });
});

describe("videoQuestionRequestSchema", () => {
  it("requires a non-empty company name", () => {
    expect(() =>
      videoQuestionRequestSchema.parse({
        companyName: "   ",
        roleDescription: "Analyst",
        count: 3
      })
    ).toThrow();
  });

  it("applies defaults for role description and count", () => {
    const parsed = videoQuestionRequestSchema.parse({ companyName: "McKinsey" });
    expect(parsed.companyName).toBe("McKinsey");
    expect(parsed.roleDescription).toBe("");
    expect(parsed.count).toBe(3);
    expect(parsed.model).toBeUndefined();
  });

  it("rejects oversized company or role text", () => {
    expect(() =>
      videoQuestionRequestSchema.parse({ companyName: "x".repeat(201) })
    ).toThrow();
    expect(() =>
      videoQuestionRequestSchema.parse({
        companyName: "Ok",
        roleDescription: "x".repeat(8001)
      })
    ).toThrow();
  });
});
