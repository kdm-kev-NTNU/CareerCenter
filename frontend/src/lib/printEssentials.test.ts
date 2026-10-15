import { describe, expect, it, vi } from "vitest";
import { escapeHtml, printEssentialsSheet } from "./printEssentials.js";

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`A <b>& "x"`)).toBe("A &lt;b&gt;&amp; &quot;x&quot;");
  });
});

describe("printEssentialsSheet", () => {
  it("returns false when the sheet is empty", () => {
    expect(printEssentialsSheet("   ")).toBe(false);
  });

  it("writes only the essentials into a print window", () => {
    const print = vi.fn();
    const close = vi.fn();
    const focus = vi.fn();
    const doc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn()
    };
    const openWindow = vi.fn(() => ({ document: doc, print, close, focus }));

    const ok = printEssentialsSheet("STAR: konflikt\nResult: løst", openWindow as typeof window.open);

    expect(ok).toBe(true);
    expect(doc.write).toHaveBeenCalledOnce();
    const html = String(doc.write.mock.calls[0]?.[0] ?? "");
    expect(html).toContain("<h1>Essentials</h1>");
    expect(html).toContain("STAR: konflikt");
    expect(html).not.toContain("Intervjussimulator");
    expect(print).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns false when the popup is blocked", () => {
    expect(printEssentialsSheet("tekst", () => null)).toBe(false);
  });
});
