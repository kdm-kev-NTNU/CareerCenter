import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { generateScalesClx, generateSwitchChallenge } from "@careercenter/shared";
import ScalesClxBoard from "./ScalesClxBoard.vue";
import SwitchChallengeBoard from "./SwitchChallengeBoard.vue";

describe("SwitchChallengeBoard", () => {
  const puzzle = generateSwitchChallenge(7);

  it("renders four input tiles, four output tiles and one button per code", () => {
    const wrapper = mount(SwitchChallengeBoard, { props: { puzzle, selectedIndex: null, revealed: false } });
    expect(wrapper.findAll(".switch-tile")).toHaveLength(8);
    expect(wrapper.findAll(".switch-code")).toHaveLength(puzzle.options.length);
  });

  it("emits the clicked code index", async () => {
    const wrapper = mount(SwitchChallengeBoard, { props: { puzzle, selectedIndex: null, revealed: false } });
    await wrapper.findAll(".switch-code")[1]!.trigger("click");
    expect(wrapper.emitted("select")).toEqual([[1]]);
  });

  it("marks the correct code once revealed", () => {
    const wrong = (puzzle.correctIndex + 1) % puzzle.options.length;
    const wrapper = mount(SwitchChallengeBoard, { props: { puzzle, selectedIndex: wrong, revealed: true } });
    const codes = wrapper.findAll(".switch-code");
    expect(codes[puzzle.correctIndex]!.classes()).toContain("is-correct");
    expect(codes[wrong]!.classes()).toContain("is-wrong");
  });
});

describe("ScalesClxBoard", () => {
  const puzzle = generateScalesClx(11);

  it("shows both example grids and four candidate grids of nine cells", () => {
    const wrapper = mount(ScalesClxBoard, { props: { puzzle, selected: [], revealed: false } });
    expect(wrapper.findAll(".clx-examples .clx-grid")).toHaveLength(2);
    const candidates = wrapper.findAll(".clx-candidate");
    expect(candidates).toHaveLength(4);
    for (const candidate of candidates) {
      expect(candidate.findAll(".clx-cell")).toHaveLength(9);
    }
  });

  it("highlights the two correct grids once revealed", () => {
    const wrapper = mount(ScalesClxBoard, { props: { puzzle, selected: [], revealed: true } });
    const correct = wrapper.findAll(".clx-candidate.is-correct");
    expect(correct).toHaveLength(2);
  });
});
