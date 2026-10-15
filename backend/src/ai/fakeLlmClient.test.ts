import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeLlmClient } from "./fakeLlmClient.js";

describe("FakeLlmClient", () => {
  it("records complete and structured calls", async () => {
    const client = new FakeLlmClient({
      completeResult: "hello",
      structuredResult: { score: 5 }
    });
    expect(client.isConfigured()).toBe(true);

    const text = await client.complete({
      messages: [{ role: "user", content: "test" }]
    });
    expect(text).toBe("hello");
    expect(client.completeCalls).toHaveLength(1);

    const schema = z.object({ score: z.number() });
    const structured = await client.completeStructured(
      { messages: [{ role: "user", content: "grade" }] },
      schema
    );
    expect(structured).toEqual({ score: 5 });
    expect(client.structuredCalls).toHaveLength(1);
  });

  it("reports not configured when disabled", () => {
    const client = new FakeLlmClient({ configured: false });
    expect(client.isConfigured()).toBe(false);
  });

  it("supports webSearch", async () => {
    const client = new FakeLlmClient({ webSearchResult: "results" });
    await expect(client.webSearch!("firm news")).resolves.toBe("results");
    expect(client.webSearchCalls).toEqual([{ query: "firm news", options: undefined }]);
  });
});
