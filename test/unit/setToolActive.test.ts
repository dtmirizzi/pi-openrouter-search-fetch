import { describe, it, expect, vi } from "vitest";
import { setToolActive } from "../../src/helpers";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function makeMockAPI(initialTools: string[]): ExtensionAPI {
  let active = [...initialTools];
  return {
    getActiveTools: vi.fn(() => [...active]),
    setActiveTools: vi.fn((tools: string[]) => {
      active = [...tools];
    }),
  } as unknown as ExtensionAPI;
}

describe("setToolActive", () => {
  it("adds a tool that is not active", () => {
    const pi = makeMockAPI(["bash", "read"]);
    setToolActive(pi, "web_search", true);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["bash", "read", "web_search"]);
  });

  it("does not add duplicate when tool is already active", () => {
    const pi = makeMockAPI(["bash", "read", "web_search"]);
    setToolActive(pi, "web_search", true);
    expect(pi.setActiveTools).not.toHaveBeenCalled();
  });

  it("removes a tool that is active", () => {
    const pi = makeMockAPI(["bash", "read", "web_search"]);
    setToolActive(pi, "web_search", false);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["bash", "read"]);
  });

  it("no-ops when removing a tool that is not active (calls setActiveTools with same list)", () => {
    const pi = makeMockAPI(["bash", "read"]);
    setToolActive(pi, "web_search", false);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["bash", "read"]);
  });

  it("handles empty initial tool list", () => {
    const pi = makeMockAPI([]);
    setToolActive(pi, "web_fetch", true);
    expect(pi.setActiveTools).toHaveBeenCalledWith(["web_fetch"]);
  });

  it("removes last tool resulting in empty list", () => {
    const pi = makeMockAPI(["web_search"]);
    setToolActive(pi, "web_search", false);
    expect(pi.setActiveTools).toHaveBeenCalledWith([]);
  });
});
