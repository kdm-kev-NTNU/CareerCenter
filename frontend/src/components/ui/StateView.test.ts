import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import StateView from "./StateView.vue";

describe("StateView", () => {
  it("renders loading default message", () => {
    const wrapper = mount(StateView, { props: { state: "loading" } });
    expect(wrapper.classes()).toContain("state-view--loading");
    expect(wrapper.text()).toContain("Laster …");
  });

  it("renders custom error message with error styling", () => {
    const wrapper = mount(StateView, {
      props: { state: "error", message: "Kunne ikke hente data." }
    });
    expect(wrapper.classes()).toContain("state-view--error");
    expect(wrapper.find(".error-text").text()).toBe("Kunne ikke hente data.");
  });

  it("renders empty state", () => {
    const wrapper = mount(StateView, {
      props: { state: "empty", message: "Ingen treff." }
    });
    expect(wrapper.classes()).toContain("state-view--empty");
    expect(wrapper.text()).toContain("Ingen treff.");
  });
});
