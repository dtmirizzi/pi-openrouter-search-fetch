import { describe, it, expect } from "vitest";
import { statusLabel } from "../../src/helpers";
import type { ExtensionState } from "../../src/helpers";

const base: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
  compactStatus: false,
};

describe("statusLabel (verbose mode — default)", () => {
  it("shows both on with engines", () => {
    expect(statusLabel(base)).toBe("search:on(auto) fetch:on(auto)");
  });
  it("search off", () => {
    expect(statusLabel({ ...base, searchEnabled: false })).toBe("search:off fetch:on(auto)");
  });
  it("fetch off", () => {
    expect(statusLabel({ ...base, fetchEnabled: false })).toBe("search:on(auto) fetch:off");
  });
  it("both off", () => {
    expect(statusLabel({ ...base, searchEnabled: false, fetchEnabled: false })).toBe("search:off fetch:off");
  });
  it("custom engines", () => {
    expect(statusLabel({ ...base, searchEngine: "exa", fetchEngine: "firecrawl" })).toBe("search:on(exa) fetch:on(firecrawl)");
  });
});

describe("statusLabel (compact mode)", () => {
  it("both on with engines", () => {
    expect(statusLabel({ ...base, compactStatus: true })).toBe("S auto  F auto");
  });
  it("search off", () => {
    expect(statusLabel({ ...base, compactStatus: true, searchEnabled: false })).toBe("S off  F auto");
  });
  it("fetch off", () => {
    expect(statusLabel({ ...base, compactStatus: true, fetchEnabled: false })).toBe("S auto  F off");
  });
  it("both off", () => {
    expect(statusLabel({ ...base, compactStatus: true, searchEnabled: false, fetchEnabled: false })).toBe("S off  F off");
  });
  it("custom engines", () => {
    expect(statusLabel({ ...base, compactStatus: true, searchEngine: "exa", fetchEngine: "firecrawl" })).toBe("S exa  F firecrawl");
  });
});
