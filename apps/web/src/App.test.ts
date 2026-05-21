import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";

describe("App", () => {
  it("renders the private auth entry by default", () => {
    localStorage.clear();
    const wrapper = mount(App);
    expect(wrapper.text()).toContain("Privat base for mastervalg");
    expect(wrapper.text()).toContain("Opprett base");
  });
});

