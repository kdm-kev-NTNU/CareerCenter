import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import EducationAiResourcesView from "./EducationAiResourcesView.vue";

describe("EducationAiResourcesView", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("shows the auto-load sync command", () => {
    const store = useEducationAiResourcesStore();
    store.exportTarget = "cursor";
    store.syncApiUrl = "http://127.0.0.1:3000";
    store.syncCwd = ".";

    const wrapper = mount(EducationAiResourcesView, {
      global: {
        plugins: [pinia]
      }
    });

    expect(wrapper.text()).toContain("Auto-load / Sync");
    expect(wrapper.find("[data-test='sync-command']").text()).toContain("ai-resource-sync.mjs");
    expect(wrapper.find("[data-test='sync-command']").text()).toContain("--target cursor");
  });
});
