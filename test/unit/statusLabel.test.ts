import { describe, it, expect } from "vitest";
import { statusLabel } from "../../src/helpers";
import type { ExtensionState } from "../../src/helpers";

const base: ExtensionState = {
  searchEnabled: true,
  searchEngine: "auto",
  fetchEnabled: true,
  fetchEngine: "auto",
  imageEnabled: false,
  visionEnabled: false,
  videoEnabled: false,
  pdfEnabled: false,
  ttsEnabled: false,
  sttEnabled: false,
  compactStatus: false,
};

describe("statusLabel (verbose mode — default)", () => {
  it("search + fetch only", () => {
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
  it("all toggles on", () => {
    expect(statusLabel({ ...base, imageEnabled: true, visionEnabled: true, videoEnabled: true, pdfEnabled: true, ttsEnabled: true, sttEnabled: true }))
      .toBe("search:on(auto) fetch:on(auto) img:on vision:on video:on pdf:on tts:on stt:on");
  });
  it("only new tools on", () => {
    expect(statusLabel({ ...base, searchEnabled: false, fetchEnabled: false, visionEnabled: true, pdfEnabled: true }))
      .toBe("search:off fetch:off vision:on pdf:on");
  });
});

describe("statusLabel (compact mode)", () => {
  const c = { ...base, compactStatus: true };
  it("search + fetch only", () => {
    expect(statusLabel(c)).toBe("S auto  F auto");
  });
  it("search off", () => {
    expect(statusLabel({ ...c, searchEnabled: false })).toBe("S off  F auto");
  });
  it("both off", () => {
    expect(statusLabel({ ...c, searchEnabled: false, fetchEnabled: false })).toBe("S off  F off");
  });
  it("custom engines", () => {
    expect(statusLabel({ ...c, searchEngine: "exa", fetchEngine: "firecrawl" })).toBe("S exa  F firecrawl");
  });
  it("all toggles on", () => {
    expect(statusLabel({ ...c, imageEnabled: true, visionEnabled: true, videoEnabled: true, pdfEnabled: true, ttsEnabled: true, sttEnabled: true }))
      .toBe("S auto  F auto  Img  Vis  Vid  PDF  TTS  STT");
  });
});
