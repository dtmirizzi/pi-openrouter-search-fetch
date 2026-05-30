import * as fs from "node:fs";
import * as os from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveApiKey } from "../../src/helpers";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(),
}));

describe("resolveApiKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns env var OPENROUTER_API_KEY when set", () => {
    process.env.OPENROUTER_API_KEY = "sk-env-test";
    const ctx = { modelRegistry: { find: vi.fn() } };
    const key = resolveApiKey(ctx);
    expect(key).toBe("sk-env-test");
  });

  it("falls back to model registry when env var not set", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = {
      modelRegistry: {
        find: vi.fn((provider: string, id?: string) => {
          if (provider === "openrouter" && id === "auto") {
            return { apiKey: "sk-registry-auto" };
          }
          return undefined;
        }),
      },
    };
    const key = resolveApiKey(ctx);
    expect(key).toBe("sk-registry-auto");
  });

  it("tries undefined id after auto if auto fails", () => {
    delete process.env.OPENROUTER_API_KEY;
    const find = vi.fn((provider: string, id?: string) => {
      if (provider === "openrouter" && id === undefined) {
        return { apiKey: "sk-registry-fallback" };
      }
      return undefined;
    });
    const ctx = { modelRegistry: { find } };
    const key = resolveApiKey(ctx);
    expect(key).toBe("sk-registry-fallback");
  });

  it("falls back to models.json when registry returns nothing", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { find: vi.fn(() => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ providers: { openrouter: { apiKey: "sk-file-key" } } }),
    );
    vi.mocked(os.homedir).mockReturnValue("/home/testuser");
    const key = resolveApiKey(ctx);
    expect(key).toBe("sk-file-key");
  });

  it("returns undefined when models.json does not exist", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { find: vi.fn(() => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const key = resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when models.json has no openrouter section", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { find: vi.fn(() => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ providers: { anthropic: { apiKey: "sk-anthro" } } }));
    const key = resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when models.json has empty apiKey", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { find: vi.fn(() => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ providers: { openrouter: { apiKey: "" } } }));
    const key = resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });

  it("returns undefined when all sources fail", () => {
    delete process.env.OPENROUTER_API_KEY;
    const ctx = { modelRegistry: { find: vi.fn(() => undefined) } };
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const key = resolveApiKey(ctx);
    expect(key).toBeUndefined();
  });
});
