import { describe, expect, it } from "vitest";
import { interviewModes } from "./interviewPrep.js";
import {
  defaultEssentialsSheets,
  defaultSimulatorSettings,
  normalizeEssentialsInput,
  resolveEssentialsSheet
} from "./simulatorSettings.js";

describe("default essentials sheets", () => {
  it("has a non-empty sheet with placeholders for every mode", () => {
    for (const mode of interviewModes) {
      const sheet = defaultEssentialsSheets[mode];
      expect(sheet.trim().length).toBeGreaterThan(100);
      expect(sheet).toMatch(/\[[^\]]+\]/);
    }
    expect(defaultEssentialsSheets.behavioral_mock).toContain("STAR");
    expect(defaultEssentialsSheets.behavioral_mock).toContain("SPØRSMÅL JEG STILLER");
    expect(defaultEssentialsSheets.case_oral).toContain("anbefaling");
  });
});

describe("resolveEssentialsSheet", () => {
  it("uses the default when nothing is stored", () => {
    expect(resolveEssentialsSheet("case_oral", null)).toEqual({
      text: defaultEssentialsSheets.case_oral,
      isDefault: true
    });
  });

  it("keeps a stored sheet, also an empty one", () => {
    expect(resolveEssentialsSheet("case_oral", "Mitt ark")).toEqual({ text: "Mitt ark", isDefault: false });
    expect(resolveEssentialsSheet("case_oral", "")).toEqual({ text: "", isDefault: false });
  });
});

describe("normalizeEssentialsInput", () => {
  it("stores null when the input equals the default", () => {
    const withNoise = `${defaultEssentialsSheets.behavioral_mock.replace(/\n/g, "\r\n")}\n  `;
    expect(normalizeEssentialsInput("behavioral_mock", withNoise)).toBeNull();
    expect(normalizeEssentialsInput("behavioral_mock", null)).toBeNull();
  });

  it("keeps a customised sheet", () => {
    expect(normalizeEssentialsInput("behavioral_mock", "Egen tekst")).toBe("Egen tekst");
    expect(normalizeEssentialsInput("behavioral_mock", "")).toBe("");
  });
});

describe("defaultSimulatorSettings", () => {
  it("returns default settings for a mode", () => {
    expect(defaultSimulatorSettings("concept_tutor")).toEqual({
      mode: "concept_tutor",
      companyName: "",
      tone: "profesjonell",
      language: "nb",
      essentialsSheet: defaultEssentialsSheets.concept_tutor,
      essentialsIsDefault: true
    });
  });
});
