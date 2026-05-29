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
    expect(s).toBe("S auto  F auto");
  });

  it("shows search off when search is disabled", () => {
    const s = statusLabel({ ...base, searchEnabled: false });
    expect(s).toBe("S off  F auto");
  });

  it("shows fetch off when fetch is disabled", () => {
    const s = statusLabel({ ...base, fetchEnabled: false });
    expect(s).toBe("S auto  F off");
  });

  it("shows both off when both are disabled", () => {
    const s = statusLabel({ ...base, searchEnabled: false, fetchEnabled: false });
    expect(s).toBe("S off  F off");
  });

  it("includes the engine name when enabled", () => {
    const s = statusLabel({ ...base, searchEngine: "exa", fetchEngine: "firecrawl" });
    expect(s).toBe("S exa  F firecrawl");
  });

  it("omits engine name when disabled (no parens)", () => {
    const s = statusLabel({ ...base, searchEnabled: false, fetchEnabled: false, searchEngine: "native", fetchEngine: "native" });
    expect(s).toBe("S off  F off");
  });
});
