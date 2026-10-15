import { defaultEssentialsSheets } from "@careercenter/shared";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { interviewPrepApi } from "../../api/interviewPrep.js";
import EssentialsSheetEditor from "./EssentialsSheetEditor.vue";

vi.mock("../../api/interviewPrep.js", () => ({
  interviewPrepApi: {
    essentialsDraft: vi.fn()
  }
}));

const api = vi.mocked(interviewPrepApi);

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll("button").find((item) => item.text().startsWith(text));
  if (!button) throw new Error(`Fant ikke knappen ${text}`);
  return button;
}

describe("EssentialsSheetEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the default sheet and marks edits as custom", async () => {
    const wrapper = mount(EssentialsSheetEditor, {
      props: { sheet: defaultEssentialsSheets.behavioral_mock, isDefault: true, mode: "behavioral_mock", aiConfigured: true }
    });
    const details = wrapper.get("details");
    expect(details.attributes("open")).toBeUndefined();
    expect(wrapper.text()).toContain("Essentials-ark");
    expect(wrapper.text()).toContain("Standard");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain("STAR");
    expect(findButton(wrapper, "Tilbakestill til standard").attributes("disabled")).toBeDefined();

    await wrapper.find("textarea").setValue("Mine stikkord");
    expect(wrapper.emitted("change")).toEqual([["Mine stikkord", false]]);
  });

  it("resets a custom sheet to the default for the mode", async () => {
    const wrapper = mount(EssentialsSheetEditor, {
      props: { sheet: "Mine stikkord", isDefault: false, mode: "case_oral", aiConfigured: true }
    });
    expect(wrapper.text()).toContain("Tilpasset");
    await findButton(wrapper, "Tilbakestill til standard").trigger("click");
    expect(wrapper.emitted("change")).toEqual([[defaultEssentialsSheets.case_oral, true]]);
  });

  it("previews an AI draft and only uses it when asked", async () => {
    api.essentialsDraft.mockResolvedValue({ draft: "STAR – utkast", sourceDocTitles: ["STAR", "Kjerne"] });
    const wrapper = mount(EssentialsSheetEditor, {
      props: { sheet: "", isDefault: false, mode: "behavioral_mock", aiConfigured: true }
    });

    await findButton(wrapper, "Lag utkast med KI").trigger("click");
    await flushPromises();
    expect(api.essentialsDraft).toHaveBeenCalledWith("behavioral_mock");
    expect(wrapper.text()).toContain("Basert på: STAR, Kjerne");
    expect(wrapper.emitted("change")).toBeUndefined();

    await findButton(wrapper, "Bruk utkastet").trigger("click");
    expect(wrapper.emitted("change")).toEqual([["STAR – utkast", false]]);
    expect(wrapper.text()).not.toContain("Utkast fra KI");
  });

  it("disables the AI draft without AI", () => {
    const wrapper = mount(EssentialsSheetEditor, {
      props: { sheet: "", isDefault: false, mode: "concept_tutor", aiConfigured: false }
    });
    expect(findButton(wrapper, "Lag utkast med KI").attributes("disabled")).toBeDefined();
  });
});
