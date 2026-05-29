import { describe, it, expect, vi } from "vitest";
import { isActiveModelOpenRouter } from "../../src/helpers";

describe("isActiveModelOpenRouter", () => {
  it("returns true when provider is 'openrouter'", () => {
    const ctx = { model: { provider: "openrouter" } };
    expect(isActiveModelOpenRouter(ctx)).toBe(true);
  });

  it("returns false when provider is 'anthropic'", () => {
    const ctx = { model: { provider: "anthropic" } };
    expect(isActiveModelOpenRouter(ctx)).toBe(false);
  });

  it("returns false when provider is 'openai'", () => {
    const ctx = { model: { provider: "openai" } };
    expect(isActiveModelOpenRouter(ctx)).toBe(false);
  });

  it("returns false when model is undefined", () => {
    const ctx = {};
    expect(isActiveModelOpenRouter(ctx)).toBe(false);
  });

  it("returns false when provider is undefined", () => {
    const ctx = { model: {} };
    expect(isActiveModelOpenRouter(ctx)).toBe(false);
  });

  it("returns false when provider is empty string", () => {
    const ctx = { model: { provider: "" } };
    expect(isActiveModelOpenRouter(ctx)).toBe(false);
  });
});
