import { describe, it, expect } from "vitest";
import { statusLabel } from "../../src/helpers";
import type { ExtensionState } from "../../src/helpers";

const base: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
  imageEnabled: false,
  ttsEnabled: false,
  sttEnabled: false,
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
  it("shows image on when enabled", () => {
    expect(statusLabel({ ...base, imageEnabled: true })).toBe("search:on(auto) fetch:on(auto) image:on");
  });
  it("shows tts on when enabled", () => {
    expect(statusLabel({ ...base, ttsEnabled: true })).toBe("search:on(auto) fetch:on(auto) tts:on");
  });
  it("shows stt on when enabled", () => {
    expect(statusLabel({ ...base, sttEnabled: true })).toBe("search:on(auto) fetch:on(auto) stt:on");
  });
  it("shows all extras when all enabled", () => {
    expect(statusLabel({ ...base, imageEnabled: true, ttsEnabled: true, sttEnabled: true })).toBe("search:on(auto) fetch:on(auto) image:on tts:on stt:on");
  });
});

describe("statusLabel (compact mode)", () => {
  const c = { ...base, compactStatus: true };
  it("both on with engines", () => {
    expect(statusLabel(c)).toBe("S auto  F auto");
  });
  it("search off", () => {
    expect(statusLabel({ ...c, searchEnabled: false })).toBe("S off  F auto");
  });
  it("fetch off", () => {
    expect(statusLabel({ ...c, fetchEnabled: false })).toBe("S auto  F off");
  });
  it("both off", () => {
    expect(statusLabel({ ...c, searchEnabled: false, fetchEnabled: false })).toBe("S off  F off");
  });
  it("custom engines", () => {
    expect(statusLabel({ ...c, searchEngine: "exa", fetchEngine: "firecrawl" })).toBe("S exa  F firecrawl");
  });
  it("shows image when enabled", () => {
    expect(statusLabel({ ...c, imageEnabled: true })).toBe("S auto  F auto  Img");
  });
  it("shows tts when enabled", () => {
    expect(statusLabel({ ...c, ttsEnabled: true })).toBe("S auto  F auto  TTS");
  });
  it("shows stt when enabled", () => {
    expect(statusLabel({ ...c, sttEnabled: true })).toBe("S auto  F auto  STT");
  });
  it("shows all extras when all enabled", () => {
    expect(statusLabel({ ...c, imageEnabled: true, ttsEnabled: true, sttEnabled: true })).toBe("S auto  F auto  Img  TTS  STT");
  });
});