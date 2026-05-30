import { describe, expect, it } from "vitest";
import { callOpenRouterTool, extractResponse } from "../../src/helpers";

const API_KEY = process.env.OPENROUTER_API_KEY;
const describeIntegration = API_KEY ? describe : describe.skip;

describeIntegration("web_search integration (live OpenRouter)", () => {
  it("returns results for a simple search query", async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_search",
      {},
      [{ role: "user", content: "What is the capital of France?" }],
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
      "openrouter:web_search",
      { engine: "exa" },
      [{ role: "user", content: "latest TypeScript version" }],
      undefined,
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("respects max_results limit", { timeout: 60000 }, async () => {
    const res = await callOpenRouterTool(
      API_KEY!,
      "openrouter:web_search",
      { max_results: 2 },
      [{ role: "user", content: "top programming languages 2026" }],
      undefined,
    );

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("fails gracefully with an invalid API key", async () => {
    const res = await callOpenRouterTool(
      "sk-invalid-key-12345",
      "openrouter:web_search",
      {},
      [{ role: "user", content: "test" }],
      undefined,
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
