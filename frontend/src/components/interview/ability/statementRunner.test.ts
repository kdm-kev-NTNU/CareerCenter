import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import {
  generateNumericalReasoning,
  startStatementSession
} from "@careercenter/shared";
import StatementTestRunner from "./StatementTestRunner.vue";
import { getAbilityProvider, isKnownAbilityProvider } from "./abilityProviders.js";

describe("abilityProviders catalog", () => {
  it("exposes AON with the playable practice tests", () => {
    expect(isKnownAbilityProvider("aon")).toBe(true);
    expect(isKnownAbilityProvider("unknown")).toBe(false);
    const aon = getAbilityProvider("aon");
    expect(aon?.tests.map((test) => test.kind)).toEqual([
      "switch_challenge",
      "scales_clx",
      "scales_numerical",
      "scales_verbal",
      "scales_mta"
    ]);
    expect(aon?.tests.every((test) => test.playable)).toBe(true);
    expect(aon?.officialUrl).toContain("prepare-for-your-online-assessment");
  });
});

describe("StatementTestRunner", () => {
  it("shows the active sheet and records a verdict", async () => {
    const test = generateNumericalReasoning(11);
    const session = startStatementSession(test, 12, Date.now());
    const wrapper = mount(StatementTestRunner, {
      props: { session, title: "Numerisk resonnering" }
    });

    expect(wrapper.text()).toContain("Påstand 1");
    expect(wrapper.text()).toContain(test.statements[0]!.text);

    await wrapper.findAll("button").find((b) => b.text() === "Sant")!.trigger("click");
    const updates = wrapper.emitted("update");
    expect(updates?.length).toBeGreaterThan(0);
    const next = updates![0]![0] as typeof session;
    expect(next.answers[test.statements[0]!.id]).toBe("true");
  });
});
