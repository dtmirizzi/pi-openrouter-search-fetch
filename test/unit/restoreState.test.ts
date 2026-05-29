import { describe, it, expect, vi } from "vitest";
import { restoreState, DEFAULT_STATE, STATE_ENTRY } from "../../src/helpers";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ExtensionState } from "../../src/helpers";

function makeCtx(branchEntries: Array<{ type: string; customType?: string; data?: unknown }>): ExtensionContext {
  return {
    sessionManager: {
      getBranch: vi.fn(() => branchEntries),
    },
  } as unknown as ExtensionContext;
}

describe("restoreState", () => {
  it("returns DEFAULT_STATE when branch is empty", () => {
    const ctx = makeCtx([]);
    const state = restoreState(ctx);
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("returns DEFAULT_STATE when no matching entry exists", () => {
    const ctx = makeCtx([
      { type: "message" },
      { type: "tool_result" },
      { type: "custom", customType: "some-other-key", data: { searchEnabled: false } },
    ]);
    const state = restoreState(ctx);
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("returns persisted state from the last matching entry", () => {
    const previous: ExtensionState = { searchEnabled: false, searchEngine: "exa", fetchEnabled: true, fetchEngine: "auto", compactStatus: false };
    const ctx = makeCtx([
      { type: "custom", customType: STATE_ENTRY, data: { searchEnabled: true, searchEngine: "auto", fetchEnabled: false, fetchEngine: "native" } },
      { type: "message" },
      { type: "custom", customType: STATE_ENTRY, data: previous },
    ]);
    const state = restoreState(ctx);
    expect(state).toEqual(previous);
  });

  it("returns DEFAULT_STATE when entry data is not an object", () => {
    const ctx = makeCtx([
      { type: "custom", customType: STATE_ENTRY, data: null },
    ]);
    const state = restoreState(ctx);
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("returns DEFAULT_STATE when entry data is undefined", () => {
    const ctx = makeCtx([
      { type: "custom", customType: STATE_ENTRY },
    ]);
    const state = restoreState(ctx);
    expect(state).toEqual(DEFAULT_STATE);
  });

  it("merges partial data with DEFAULT_STATE", () => {
    const ctx = makeCtx([
      { type: "custom", customType: STATE_ENTRY, data: { searchEnabled: false } },
    ]);
    const state = restoreState(ctx);
    expect(state.searchEnabled).toBe(false);
    // other fields fall back to defaults
    expect(state.searchEngine).toBe(DEFAULT_STATE.searchEngine);
    expect(state.fetchEnabled).toBe(DEFAULT_STATE.fetchEnabled);
    expect(state.fetchEngine).toBe(DEFAULT_STATE.fetchEngine);
  });
});
