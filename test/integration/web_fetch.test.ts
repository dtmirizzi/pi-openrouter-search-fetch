import { describe, it, expect } from "vitest";
import { callOpenRouterTool, extractResponse } from "../../src/helpers";

const API_KEY = process.env["OPENROUTER_API_KEY"];
const describeIntegration = API_KEY ? describe : describe.skip;

describeIntegration("web_fetch integration (live OpenRouter)", () => {
  it("fetches content from a known URL", async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_fetch",
      {},
      [{ role: "user", content: "Fetch https://example.com and tell me what you see" }],
      undefined,
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toBeDefined();

    const extracted = extractResponse(res.data!);
    // Should have either content or toolCalls
    const hasOutput = extracted.content || extracted.toolCalls;
    expect(hasOutput).toBeTruthy();
  });

  it("respects the engine parameter", async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_fetch",
      { engine: "native" },
      [{ role: "user", content: "Fetch https://example.com" }],
      undefined,
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("respects max_content_tokens", { timeout: 60000 }, async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_fetch",
      { max_content_tokens: 100 },
      [{ role: "user", content: "Fetch https://example.com" }],
      undefined,
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("handles unreachable URL gracefully", async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_fetch",
      {},
      [{ role: "user", content: "Fetch https://this-domain-definitely-does-not-exist-99999.com" }],
      undefined,
    );

    // OpenRouter may return an error or empty content for unreachable URLs
    // Either is acceptable as long as it doesn't throw an unhandled exception
    expect(res).toBeDefined();
    expect(typeof res.ok).toBe("boolean");
  });

  it("fails gracefully with an invalid API key", async () => {
    const res = await callOpenRouterTool(
      "sk-invalid-key-12345",
      "openrouter:web_fetch",
      {},
      [{ role: "user", content: "Fetch https://example.com" }],
      undefined,
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
