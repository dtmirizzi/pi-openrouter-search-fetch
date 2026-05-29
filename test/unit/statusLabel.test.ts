import { describe, it, expect } from "vitest";
import { statusLabel } from "../../src/helpers";
import type { ExtensionState } from "../../src/helpers";

describe("statusLabel", () => {
  const base: ExtensionState = {
    searchEnabled: true,
    searchEngine: "auto",
    fetchEnabled: true,
    fetchEngine: "auto",
  };

  it("shows both on with engines when both enabled", () => {
    const s = statusLabel(base);
    expect(s).toBe("search:on(auto) fetch:on(auto)");
  });

  it("shows search off when search is disabled", () => {
    const s = statusLabel({ ...base, searchEnabled: false });
    expect(s).toBe("search:off fetch:on(auto)");
  });

  it("shows fetch off when fetch is disabled", () => {
    const s = statusLabel({ ...base, fetchEnabled: false });
    expect(s).toBe("search:on(auto) fetch:off");
  });

  it("shows both off when both are disabled", () => {
    const s = statusLabel({ ...base, searchEnabled: false, fetchEnabled: false });
    expect(s).toBe("search:off fetch:off");
  });

  it("includes the engine name when enabled", () => {
    const s = statusLabel({ ...base, searchEngine: "exa", fetchEngine: "firecrawl" });
    expect(s).toBe("search:on(exa) fetch:on(firecrawl)");
  });

  it("omits engine name when disabled (no parens)", () => {
    const s = statusLabel({ ...base, searchEnabled: false, fetchEnabled: false, searchEngine: "native", fetchEngine: "native" });
    expect(s).toBe("search:off fetch:off");
  });
});
