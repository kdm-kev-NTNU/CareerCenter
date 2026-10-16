import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  MTA_AIRCRAFT_HALF_HEIGHT,
  MTA_GATE_STEP,
  formatMtaEquation,
  generateScalesMta,
  startMtaSession
} from "@careercenter/shared";
import MtaRunner from "./MtaRunner.vue";

describe("MtaRunner", () => {
  const timeline = generateScalesMta(21, 60_000);
  const session = startMtaSession(timeline, 1, Date.now());

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders sky, equation, letters, gate controls and timer", () => {
    const wrapper = mount(MtaRunner, {
      props: { session, title: "Scales MTA VI" }
    });
    expect(wrapper.find(".mta-sky").exists()).toBe(true);
    expect(wrapper.find(".mta-timer").text()).toMatch(/minute\(s\) to go/);
    const eq = timeline.equations[0]!;
    expect(wrapper.text()).toContain(formatMtaEquation(eq));
    expect(wrapper.text()).toContain(timeline.letterChains[0]!.letters.join(" "));
    expect(wrapper.findAll(".mta-btn")).toHaveLength(4);
    expect(wrapper.findAll(".mta-gate-btn")).toHaveLength(2);
  });

  it("moves the gate when the player presses the control", async () => {
    const wrapper = mount(MtaRunner, {
      props: { session, title: "Scales MTA VI" }
    });
    await wrapper.findAll(".mta-gate-btn")[1]!.trigger("click");
    const emitted = wrapper.emitted("update");
    expect(emitted).toBeTruthy();
    const next = emitted![0]![0] as typeof session;
    expect(next.gateCenter).toBeCloseTo(session.gateCenter + MTA_GATE_STEP);
  });

  it("advances the equation after answering", async () => {
    const wrapper = mount(MtaRunner, {
      props: { session, title: "Scales MTA VI" }
    });
    const first = formatMtaEquation(timeline.equations[0]!);
    const buttons = wrapper.findAll(".mta-btn");
    await buttons[0]!.trigger("click");
    const emitted = wrapper.emitted("update");
    expect(emitted).toBeTruthy();
    expect(emitted!.length).toBeGreaterThanOrEqual(1);
    const next = emitted![0]![0] as typeof session;
    expect(next.equationIndex).toBe(1);
    expect(next.equationJudgments).toHaveLength(1);
    expect(formatMtaEquation(timeline.equations[0]!)).toBe(first);
  });

  it("renders the aircraft as a non-button sized from MTA_AIRCRAFT_HALF_HEIGHT", () => {
    const t0 = 1_000_000;
    const ac = timeline.aircraft[0]!;
    vi.useFakeTimers();
    vi.setSystemTime(t0 + ac.startOffsetMs + 1_000);
    const earlySession = startMtaSession(timeline, 1, t0);

    const wrapper = mount(MtaRunner, {
      props: { session: earlySession, title: "Scales MTA VI" }
    });

    const plane = wrapper.find(".mta-aircraft");
    expect(plane.exists()).toBe(true);
    expect(plane.element.tagName.toLowerCase()).toBe("div");
    const style = plane.attributes("style") ?? "";
    const expectedHeight = `${MTA_AIRCRAFT_HALF_HEIGHT * 2 * 100}%`;
    expect(style).toContain(`height: ${expectedHeight}`);

    wrapper.unmount();
  });
});
