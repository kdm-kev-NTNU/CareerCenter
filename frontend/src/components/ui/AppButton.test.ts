import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AppButton from "./AppButton.vue";

describe("AppButton", () => {
  it("applies primary variant by default", () => {
    const wrapper = mount(AppButton, { slots: { default: "Lagre" } });
    expect(wrapper.classes()).toContain("primary");
    expect(wrapper.text()).toBe("Lagre");
  });

  it("disables the button while loading", () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: "Lagre" }
    });
    expect(wrapper.attributes("disabled")).toBeDefined();
    expect(wrapper.classes()).toContain("is-loading");
  });

  it("respects explicit disabled even when not loading", () => {
    const wrapper = mount(AppButton, {
      props: { disabled: true, variant: "ghost" },
      slots: { default: "Avbryt" }
    });
    expect(wrapper.classes()).toContain("ghost");
    expect(wrapper.attributes("disabled")).toBeDefined();
  });
});
