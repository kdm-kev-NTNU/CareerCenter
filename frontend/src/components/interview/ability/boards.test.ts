import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { generateScalesClx, generateSwitchChallenge } from "@careercenter/shared";
import ScalesClxBoard from "./ScalesClxBoard.vue";
import SwitchChallengeBoard from "./SwitchChallengeBoard.vue";

describe("SwitchChallengeBoard", () => {
  const puzzle = generateSwitchChallenge(7, 3);

  it("renders four input tiles, four output tiles and one button per code", () => {
    expect(puzzle.stage).toBe(1);
    if (puzzle.stage !== 1) return;
    const wrapper = mount(SwitchChallengeBoard, {
      props: {
        puzzle,
        selectedIndex: null,
        selectedPair: [null, null],
        revealed: false
      }
    });
    expect(wrapper.findAll(".switch-tile")).toHaveLength(8);
    expect(wrapper.findAll(".switch-code")).toHaveLength(puzzle.options.length);
  });

  it("emits the clicked code index", async () => {
    expect(puzzle.stage).toBe(1);
    if (puzzle.stage !== 1) return;
    const wrapper = mount(SwitchChallengeBoard, {
      props: {
        puzzle,
        selectedIndex: null,
        selectedPair: [null, null],
        revealed: false
      }
    });
    await wrapper.findAll(".switch-code")[1]!.trigger("click");
    expect(wrapper.emitted("select")).toEqual([[1]]);
  });

  it("marks the correct code once revealed", () => {
    expect(puzzle.stage).toBe(1);
    if (puzzle.stage !== 1) return;
    const wrong = (puzzle.correctIndex + 1) % puzzle.options.length;
    const wrapper = mount(SwitchChallengeBoard, {
      props: {
        puzzle,
        selectedIndex: wrong,
        selectedPair: [null, null],
        revealed: true
      }
    });
    const codes = wrapper.findAll(".switch-code");
    expect(codes[puzzle.correctIndex]!.classes()).toContain("is-correct");
    expect(codes[wrong]!.classes()).toContain("is-wrong");
  });

  it("Stage 2 shows two rows of three codes with previews and emits selectRow", async () => {
    const stage2 = generateSwitchChallenge(11, 8);
    expect(stage2.stage).toBe(2);
    if (stage2.stage !== 2) return;

    const wrapper = mount(SwitchChallengeBoard, {
      props: {
        puzzle: stage2,
        selectedIndex: null,
        selectedPair: [null, null],
        revealed: false
      }
    });

    expect(wrapper.findAll(".switch-stage2-row")).toHaveLength(2);
    expect(wrapper.findAll(".switch-code-card")).toHaveLength(6);
    expect(wrapper.findAll(".switch-preview")).toHaveLength(6);
    for (const preview of wrapper.findAll(".switch-preview")) {
      expect(preview.findAll(".switch-preview-tile")).toHaveLength(4);
    }

    const cards = wrapper.findAll(".switch-code-card");
    await cards[1]!.trigger("click");
    expect(wrapper.emitted("selectRow")?.[0]).toEqual([{ row: 0, index: 1 }]);
    await cards[4]!.trigger("click");
    expect(wrapper.emitted("selectRow")?.[1]).toEqual([{ row: 1, index: 1 }]);
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
